import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WS_EVENTS, SeatStatus } from '@ailin/shared';
import { RealtimeService } from './realtime.service';

export interface SeatUpdatePayload {
  sessionId: string;
  seatId: string;
  status: SeatStatus;
}

function room(sessionId: string) {
  return `session:${sessionId}`;
}

/** Общая комната всех гостевых дисплеев — для рассылки «какой сеанс показывать». */
const DISPLAY_ROOM = 'display';

@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /** Какие места удерживает каждый сокет — для освобождения при дисконнекте. */
  private holdsBySocket = new Map<string, Set<string>>(); // socketId → "sessionId|seatId"

  constructor(private readonly realtime: RealtimeService) {
    // Сервис эмитит сюда обновления из доменных модулей (продажа/бронь/возврат)
    this.realtime.bindEmitter((p) => this.emitSeatUpdate(p));
  }

  handleConnection() {
    // no-op; подписка происходит явным сообщением JOIN_SESSION
  }

  /** Кассир закрыл вкладку — освобождаем все его удержанные места. */
  handleDisconnect(client: Socket) {
    const keys = this.holdsBySocket.get(client.id);
    if (!keys) return;
    for (const key of keys) {
      const [sessionId, seatId] = key.split('|');
      // Эмитим FREE только если удержание ещё активно (место не выкуплено тем временем)
      if (this.realtime.removeHold(sessionId, seatId)) {
        this.emitSeatUpdate({ sessionId, seatId, status: SeatStatus.FREE });
      }
    }
    this.holdsBySocket.delete(client.id);
  }

  /** Касса выбрала/сняла место (до оплаты) — транслируем удержание гостям. */
  @SubscribeMessage(WS_EVENTS.SEAT_HOLD)
  onSeatHold(
    @MessageBody() data: { sessionId: string; seatId: string; hold: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.sessionId || !data?.seatId) return;
    const key = `${data.sessionId}|${data.seatId}`;
    if (data.hold) {
      if (this.realtime.addHold(data.sessionId, data.seatId)) {
        let set = this.holdsBySocket.get(client.id);
        if (!set) {
          set = new Set();
          this.holdsBySocket.set(client.id, set);
        }
        set.add(key);
        this.emitSeatUpdate({ sessionId: data.sessionId, seatId: data.seatId, status: SeatStatus.SELECTED });
      }
    } else {
      if (this.realtime.removeHold(data.sessionId, data.seatId)) {
        this.holdsBySocket.get(client.id)?.delete(key);
        this.emitSeatUpdate({ sessionId: data.sessionId, seatId: data.seatId, status: SeatStatus.FREE });
      }
    }
  }

  /** Клиент (касса/дисплей) подписывается на сеанс и сразу получает снимок мест. */
  @SubscribeMessage(WS_EVENTS.JOIN_SESSION)
  async onJoin(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.sessionId) return;
    await client.join(room(data.sessionId));
    const snapshot = await this.realtime.getSeatSnapshot(data.sessionId);
    client.emit(WS_EVENTS.SEAT_SNAPSHOT, { sessionId: data.sessionId, seats: snapshot });
  }

  @SubscribeMessage(WS_EVENTS.LEAVE_SESSION)
  async onLeave(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.sessionId) return;
    await client.leave(room(data.sessionId));
  }

  /** Рассылка обновления одного места всем подписчикам сеанса. */
  emitSeatUpdate(payload: SeatUpdatePayload) {
    this.server.to(room(payload.sessionId)).emit(WS_EVENTS.SEAT_UPDATE, payload);
  }

  /** Дисплей гостей подписывается на канал «какой сеанс показывать». */
  @SubscribeMessage(WS_EVENTS.DISPLAY_JOIN)
  async onDisplayJoin(@ConnectedSocket() client: Socket) {
    await client.join(DISPLAY_ROOM);
    const sessionId = this.realtime.getDisplaySession();
    if (sessionId) {
      client.emit(WS_EVENTS.DISPLAY_SESSION, { sessionId });
    }
  }

  /** Касса переключает дисплей гостей на другой сеанс. */
  @SubscribeMessage(WS_EVENTS.DISPLAY_SET)
  onDisplaySet(@MessageBody() data: { sessionId: string }) {
    if (!data?.sessionId) return;
    this.realtime.setDisplaySession(data.sessionId);
    this.server.to(DISPLAY_ROOM).emit(WS_EVENTS.DISPLAY_SESSION, { sessionId: data.sessionId });
  }
}
