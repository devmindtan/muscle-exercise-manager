import { memo } from 'react';
import { SegmentalBody } from '@/src/components/BodyMetricsSegmental';
import type { BodyMeasurement } from '@/src/types/database';

interface SegmentalTabProps {
  historyByMetric: Map<string, BodyMeasurement[]>;
}

function SegmentalTabComponent({ historyByMetric }: SegmentalTabProps) {
  return <SegmentalBody historyByMetric={historyByMetric} />;
}

export const SegmentalTab = memo(SegmentalTabComponent);
