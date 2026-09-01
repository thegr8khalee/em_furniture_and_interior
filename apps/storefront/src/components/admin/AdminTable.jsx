import Card from '../ui/Card';

/**
 * Reusable admin table wrapper with consistent styling.
 *
 * Usage:
 * <AdminTable
 *   columns={[
 *     { key: 'name', label: 'Name' },
 *     { key: 'status', label: 'Status', align: 'center' },
 *     { key: 'total', label: 'Total', align: 'right' },
 *   ]}
 *   data={rows}
 *   renderRow={(row) => (
 *     <tr key={row._id}>
 *       <td className="px-6 py-3">{row.name}</td>
 *       ...
 *     </tr>
 *   )}
 *   emptyMessage="No items found"
 *   loading={isLoading}
 * />
 */
const AdminTable = ({ columns = [], data = [], renderRow, emptyMessage = 'No data', loading = false }) => {
  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-base-300 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-base-200">
                    {columns.map((col) => (
                      <td key={col.key} className="px-6 py-3">
                        <div className="h-4 w-3/4 animate-pulse bg-base-200 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.length === 0
                ? (
                    <tr>
                      <td colSpan={columns.length} className="px-6 py-10 text-center text-neutral/50">
                        {emptyMessage}
                      </td>
                    </tr>
                  )
                : data.map(renderRow)}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default AdminTable;
