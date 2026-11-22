type Option = { id: string; name: string };
export function ReportFilters({
  courses,
  batches,
  teachers = [],
  defaults = {},
}: {
  courses: Option[];
  batches: Option[];
  teachers?: { id: string; fullName: string }[];
  defaults?: Record<string, string | undefined>;
}) {
  return (
    <form className="mb-5 grid items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-6">
      <label className="grid gap-1 text-xs font-medium text-slate-500">
        From
        <input className="input" type="date" name="from" defaultValue={defaults.from} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-500">
        To
        <input className="input" type="date" name="to" defaultValue={defaults.to} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-500">
        Course
        <select name="courseId" className="input" defaultValue={defaults.courseId}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-500">
        Batch
        <select name="batchId" className="input" defaultValue={defaults.batchId}>
          <option value="">All batches</option>
          {batches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-500">
        Teacher
        <select name="teacherId" className="input" defaultValue={defaults.teacherId}>
          <option value="">All teachers</option>
          {teachers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
      </label>
      <button
        className="min-h-11 rounded-lg bg-[#072B62] px-4 font-semibold text-white"
        type="submit"
      >
        Apply filters
      </button>
    </form>
  );
}
