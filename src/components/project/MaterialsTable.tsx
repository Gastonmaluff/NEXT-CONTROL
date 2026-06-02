type Material = {
  item: string;
  quantity: string;
};

export default function MaterialsTable({ items }: { items: Material[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-next-light text-xs uppercase text-next-blue">
          <tr>
            <th className="px-4 py-3 font-black">Material</th>
            <th className="px-4 py-3 text-right font-black">Cantidad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => (
            <tr key={item.item}>
              <td className="px-4 py-3 font-bold text-next-text">{item.item}</td>
              <td className="px-4 py-3 text-right font-semibold text-next-muted">
                {item.quantity}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
