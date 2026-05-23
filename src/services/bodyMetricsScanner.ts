import * as FileSystem from 'expo-file-system/legacy';

export type ScannedMetric = {
  metricKey:
    | 'weight'
    | 'skeletal_muscle_mass'
    | 'body_fat_mass'
    | 'pbf'
    | 'bmi'
    | 'waist_hip_ratio'
    | 'visceral_fat_level';
  label: string;
  value: number;
  unit: string;
  confidence: 'high' | 'medium';
};

export type InBodyScanResult = {
  metrics: ScannedMetric[];
  rawText: string;
};

const OCR_API_URL = 'https://api.ocr.space/parse/image';

function normalizeText(input: string) {
  return input
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/\u00a0/g, ' ');
}

function parseNumber(raw: string) {
  const normalized = raw.replace(/,/g, '.').trim();
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}

function takeBestValue(matches: RegExpExecArray[]) {
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return parseNumber(last[1]);
}

function collectMatches(text: string, regex: RegExp) {
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    matches.push(match);
    match = regex.exec(text);
  }
  return matches;
}

export function extractImportantInBodyMetrics(rawText: string): ScannedMetric[] {
  const text = normalizeText(rawText);
  const metrics: ScannedMetric[] = [];

  const patterns: {
    key: ScannedMetric['metricKey'];
    label: string;
    unit: string;
    regex: RegExp;
    confidence: ScannedMetric['confidence'];
  }[] = [
    {
      key: 'weight',
      label: 'Cân nặng',
      unit: 'kg',
      regex: /(?:^|\n|\s)Weight\s*(?:\(kg\))?\s*([0-9]+(?:[.,][0-9]+)?)/gim,
      confidence: 'high',
    },
    {
      key: 'skeletal_muscle_mass',
      label: 'Skeletal Muscle Mass',
      unit: 'kg',
      regex: /(?:SMM|Skeletal\s*Muscle\s*Mass)\s*(?:\(kg\))?\s*([0-9]+(?:[.,][0-9]+)?)/gim,
      confidence: 'high',
    },
    {
      key: 'body_fat_mass',
      label: 'Body Fat Mass',
      unit: 'kg',
      regex: /Body\s*Fat\s*Mass\s*(?:\(kg\))?\s*([0-9]+(?:[.,][0-9]+)?)/gim,
      confidence: 'high',
    },
    {
      key: 'pbf',
      label: 'Percent Body Fat',
      unit: '%',
      regex: /(?:PBF|Percent\s*Body\s*Fat)\s*(?:\(%\))?\s*([0-9]+(?:[.,][0-9]+)?)/gim,
      confidence: 'high',
    },
    {
      key: 'bmi',
      label: 'BMI',
      unit: 'BMI',
      regex: /(?:^|\n|\s)BMI\s*(?:\(kg\/m2\))?\s*([0-9]+(?:[.,][0-9]+)?)/gim,
      confidence: 'high',
    },
    {
      key: 'waist_hip_ratio',
      label: 'Waist-Hip Ratio',
      unit: 'ratio',
      regex: /Waist[-\s]*Hip\s*Ratio\s*([0-9]+(?:[.,][0-9]+)?)/gim,
      confidence: 'medium',
    },
    {
      key: 'visceral_fat_level',
      label: 'Visceral Fat Level',
      unit: 'level',
      regex: /Visceral\s*Fat\s*Level\s*(?:Level\s*)?([0-9]+(?:[.,][0-9]+)?)/gim,
      confidence: 'medium',
    },
  ];

  for (const pattern of patterns) {
    const matches = collectMatches(text, pattern.regex);
    const value = takeBestValue(matches);
    if (value == null) continue;

    metrics.push({
      metricKey: pattern.key,
      label: pattern.label,
      value,
      unit: pattern.unit,
      confidence: pattern.confidence,
    });
  }

  const unique = new Map<ScannedMetric['metricKey'], ScannedMetric>();
  for (const metric of metrics) {
    if (!unique.has(metric.metricKey)) {
      unique.set(metric.metricKey, metric);
    }
  }

  return Array.from(unique.values());
}

export async function scanInBodySheetFromImage(imageUri: string): Promise<InBodyScanResult> {
  const apiKey = process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Thiếu EXPO_PUBLIC_OCR_SPACE_API_KEY. Vui lòng cấu hình API key OCR để dùng tính năng quét.'
    );
  }

  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const formData = new FormData();
  formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('OCREngine', '2');

  const response = await fetch(OCR_API_URL, {
    method: 'POST',
    headers: {
      apikey: apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR request failed (${response.status})`);
  }

  const data = await response.json();
  const rawText = (data?.ParsedResults?.[0]?.ParsedText || '') as string;

  if (!rawText.trim()) {
    throw new Error('Không nhận diện được văn bản từ ảnh. Hãy chụp rõ hơn và đủ sáng.');
  }

  const metrics = extractImportantInBodyMetrics(rawText);

  return {
    metrics,
    rawText,
  };
}
