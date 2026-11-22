import type { Field } from '@/components/shared/entity-form';
import { localDate } from '@/lib/utils';
export const statusField: Field = {
  name: 'status',
  label: 'Status',
  defaultValue: 'active',
  options: [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ],
};
export const studentFields: Field[] = [
  { name: 'fullName', label: 'Full name', required: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: true },
  { name: 'email', label: 'Email (optional)', type: 'email' },
  { name: 'joinedOn', label: 'Joined on', type: 'date', defaultValue: localDate(), required: true },
  { name: 'notes', label: 'Notes (optional)', type: 'textarea' },
  statusField,
];
export const courseFields: Field[] = [
  { name: 'name', label: 'Course name', required: true },
  { name: 'code', label: 'Course code', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  statusField,
];
export function teacherFields(edit = false): Field[] {
  return [
    { name: 'fullName', label: 'Full name', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', type: 'tel' },
    {
      name: 'password',
      label: edit
        ? 'New password (leave blank to keep current)'
        : 'Initial password (at least 14 characters)',
      type: 'password',
      required: !edit,
    },
    statusField,
  ];
}
export function batchFields(courses: { id: string; name: string }[]): Field[] {
  return [
    { name: 'name', label: 'Batch name', required: true },
    { name: 'code', label: 'Batch code', required: true },
    {
      name: 'courseId',
      label: 'Course',
      options: courses.map((c) => ({ value: c.id, label: c.name })),
      required: true,
    },
    {
      name: 'startDate',
      label: 'Start date',
      type: 'date',
      required: true,
      defaultValue: localDate(),
    },
    { name: 'endDate', label: 'End date (optional)', type: 'date' },
    statusField,
  ];
}
export const scheduleFields: Field[] = [
  {
    name: 'weekday',
    label: 'Weekday',
    required: true,
    options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
      (d, i) => ({ value: String(i + 1), label: d }),
    ),
  },
  { name: 'startTime', label: 'Class starts', type: 'time', required: true },
  { name: 'endTime', label: 'Class ends', type: 'time', required: true },
  {
    name: 'effectiveFrom',
    label: 'Effective from',
    type: 'date',
    required: true,
    defaultValue: localDate(),
  },
  { name: 'effectiveUntil', label: 'Effective until (optional)', type: 'date' },
  statusField,
];
