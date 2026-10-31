import { useQuery } from '@tanstack/react-query'
import { getDashboard } from './api'

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })