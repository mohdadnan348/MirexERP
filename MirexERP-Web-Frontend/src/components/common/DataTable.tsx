import "./DataTable.css";
export function DataTable({ children }: { children?: React.ReactNode }) {
 return <div className="datatable">{children ?? "DataTable component"}</div>;
}
