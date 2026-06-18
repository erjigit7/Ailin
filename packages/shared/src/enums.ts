/** Состояние места в рамках конкретного сеанса. */
export enum SeatStatus {
  FREE = 'FREE',
  SOLD = 'SOLD',
  BOOKED = 'BOOKED',
  /** Только клиентское состояние кассы (в БД не хранится). */
  SELECTED = 'SELECTED',
}

/** Цвета статусов мест по ТЗ. */
export const SEAT_STATUS_COLOR: Record<SeatStatus, string> = {
  [SeatStatus.FREE]: '#d32f2f', // красный — свободно
  [SeatStatus.SOLD]: '#616161', // серый — занято
  [SeatStatus.BOOKED]: '#f9a825', // жёлтый — забронировано
  [SeatStatus.SELECTED]: '#2e9e5b', // зелёный — выбрано
};

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  QR = 'QR',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
}

export enum MovieFormat {
  TWO_D = '2D',
  THREE_D = '3D',
}

/** Категория билета (взрослый/детский/льготный). Настраивается, поэтому хранится в БД. */
export enum TicketCategoryCode {
  ADULT = 'ADULT',
  CHILD = 'CHILD',
  CONCESSION = 'CONCESSION',
}

export enum InventoryMovementType {
  PURCHASE = 'PURCHASE', // приход
  WRITE_OFF = 'WRITE_OFF', // списание
  SALE = 'SALE', // продажа
}

/** Socket.IO события. */
export const WS_EVENTS = {
  /** клиент → сервер: подписаться на сеанс */
  JOIN_SESSION: 'session:join',
  /** клиент → сервер: отписаться */
  LEAVE_SESSION: 'session:leave',
  /** сервер → клиенты: изменился статус места */
  SEAT_UPDATE: 'seat:update',
  /** сервер → клиенты: полное состояние мест сеанса (при подписке) */
  SEAT_SNAPSHOT: 'seat:snapshot',
  /** касса → сервер: удержать/освободить место при выборе (до оплаты) */
  SEAT_HOLD: 'seat:hold',

  /** дисплей → сервер: подписаться на канал «какой сеанс показывать» */
  DISPLAY_JOIN: 'display:join',
  /** касса → сервер: переключить дисплей гостей на сеанс */
  DISPLAY_SET: 'display:set',
  /** сервер → дисплеям: текущий сеанс для показа */
  DISPLAY_SESSION: 'display:session',
} as const;
