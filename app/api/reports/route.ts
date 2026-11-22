import { requireActor } from '@/lib/auth/permissions';
import { AppError } from '@/lib/errors';
import { parseReportFilters } from '@/lib/report-filters';
import { reportRows } from '@/lib/services/queries';
import { ZodError } from 'zod';
export async function GET(request: Request) {
  try {
    await requireActor(true);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const filters = parseReportFilters(params);
    const rows = await reportRows(filters);
    const format = params.format;
    const headers = {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="aecs-attendance.${format === 'xlsx' ? 'xlsx' : 'pdf'}"`,
    };
    if (format === 'xlsx') {
      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      const sheet = workbook.addWorksheet('Attendance');
      sheet.columns = [
        { header: 'Student code', key: 'student_code', width: 19 },
        { header: 'Student', key: 'full_name', width: 28 },
        { header: 'Course', key: 'course_name', width: 20 },
        { header: 'Batch', key: 'batch_name', width: 28 },
        { header: 'Present', key: 'present', width: 12 },
        { header: 'Absent', key: 'absent', width: 12 },
        { header: 'Late', key: 'late', width: 12 },
        { header: 'Excused', key: 'excused', width: 12 },
        { header: 'Eligible', key: 'eligible', width: 12 },
        { header: 'Attendance %', key: 'percentage', width: 18 },
      ];
      rows.forEach((r) => sheet.addRow(r));
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF072B62' } };
      sheet.autoFilter = 'A1:J1';
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      return new Response(new Uint8Array(await workbook.xlsx.writeBuffer()), {
        headers: {
          ...headers,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
    }
    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape' });
      let y = 24;
      const heading = () => {
        doc.setFontSize(18);
        doc.setTextColor('#072B62');
        doc.text('AECS Attend · Attendance report', 14, 15);
        doc.setFontSize(9);
        doc.setTextColor('#475569');
        doc.text(
          `${filters.from ?? 'All dates'} — ${filters.to ?? 'Present'} | Submitted sessions only | Excused excluded`,
          14,
          23,
        );
        doc.text('Student / code', 14, 33);
        doc.text('Batch', 100, 33);
        doc.text('Present', 180, 33);
        doc.text('Absent', 204, 33);
        doc.text('Eligible', 228, 33);
        doc.text('Attendance', 254, 33);
        y = 42;
      };
      heading();
      for (const r of rows) {
        if (y > 190) {
          doc.addPage();
          heading();
        }
        doc.setTextColor('#1e293b');
        doc.text(doc.splitTextToSize(`${r.full_name} / ${r.student_code}`, 80), 14, y);
        doc.text(doc.splitTextToSize(r.batch_name, 70), 100, y);
        doc.text(String(r.present), 180, y);
        doc.text(String(r.absent), 204, y);
        doc.text(String(r.eligible), 228, y);
        doc.text(r.percentage === null ? 'N/A' : `${r.percentage}%`, 254, y);
        y += 14;
      }
      if (!rows.length) doc.text('No attendance records in this date range.', 14, y);
      return new Response(doc.output('arraybuffer'), {
        headers: { ...headers, 'Content-Type': 'application/pdf' },
      });
    }
    return Response.json({ error: 'Choose format=xlsx or format=pdf.' }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof AppError ? error.message : 'Unable to generate report.' },
      {
        status: error instanceof AppError ? error.status : error instanceof ZodError ? 400 : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
