import "./ConfirmDialog.css";
export function ConfirmDialog({ children }: { children?: React.ReactNode }) {
 return <div className="confirmdialog">{children ?? "ConfirmDialog component"}</div>;
}
