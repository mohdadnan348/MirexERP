import { ModuleWorkspace } from "@/components/modules/ModuleWorkspace";
import { InventoryStockPanel } from "@/components/inventory/InventoryStockPanel";
import { InventoryProcurementPanel } from "@/components/inventory/InventoryProcurementPanel";
export default function Page(){return <><ModuleWorkspace moduleKey="inventory"/><InventoryStockPanel/><InventoryProcurementPanel/></>;}
