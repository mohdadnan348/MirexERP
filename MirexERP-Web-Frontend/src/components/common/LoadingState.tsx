import "./LoadingState.css";
export function LoadingState({ children }: { children?: React.ReactNode }) {
 return <div className="loadingstate">{children ?? "LoadingState component"}</div>;
}
