import { api } from "./api/client";
export const transportService = { async mine() { return (await api.get("/transport/me")).data.data; } };
