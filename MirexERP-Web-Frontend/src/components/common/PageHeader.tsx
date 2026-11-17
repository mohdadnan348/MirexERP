import "./PageHeader.css";
export function PageHeader({ children }: { children?: React.ReactNode }) {
 return <div className="pageheader">{children ?? "PageHeader component"}</div>;
}
