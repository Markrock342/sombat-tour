import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import JobSummaryModal from './JobSummaryModal';
import { fetchJobByNumber } from '../data/api';

// เปิดสรุปงานตรงจาก URL: ?previewJob=120516 (web เท่านั้น — ดู layout)
export default function JobPreviewLauncher() {
  const [job, setJob] = useState(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('previewJob');
    if (!id) return;
    fetchJobByNumber(id).then((row) => {
      if (row) setJob(row);
    });
  }, []);

  if (!job) return null;
  return <JobSummaryModal job={job} onClose={() => setJob(null)} />;
}
