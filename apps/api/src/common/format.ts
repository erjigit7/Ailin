import { MovieFormat } from '@prisma/client';

/**
 * Формат фильма: в БД хранится как "2D"/"3D" (через @map), но клиент Prisma
 * оперирует идентификаторами TWO_D/THREE_D. На границе API общаемся понятными
 * "2D"/"3D", поэтому конвертируем туда-обратно.
 */
export function toDbFormat(v?: string): MovieFormat | undefined {
  if (v === '2D' || v === 'TWO_D') return MovieFormat.TWO_D;
  if (v === '3D' || v === 'THREE_D') return MovieFormat.THREE_D;
  return undefined;
}

export function fromDbFormat(v: MovieFormat | string): '2D' | '3D' {
  return v === MovieFormat.THREE_D || v === '3D' ? '3D' : '2D';
}

/** Подменяет movie.format в произвольном объекте на "2D"/"3D" для ответа клиенту. */
export function mapMovieOut<T extends { format: any } | null>(movie: T): T {
  if (movie && 'format' in movie) {
    (movie as any).format = fromDbFormat((movie as any).format);
  }
  return movie;
}
