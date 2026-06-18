import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getCurrentShift, openShift, closeShift } from './api';

/** Текущая открытая смена кассира + операции открытия/закрытия. */
export function useCurrentShift() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['current-shift'], queryFn: getCurrentShift });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['current-shift'] });

  const open = useMutation({ mutationFn: openShift, onSuccess: invalidate });
  const close = useMutation({ mutationFn: closeShift, onSuccess: invalidate });

  return { shift: query.data ?? null, loading: query.isLoading, open, close };
}
