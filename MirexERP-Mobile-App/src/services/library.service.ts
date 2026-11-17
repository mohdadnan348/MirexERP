import { api } from "./api/client";
export const libraryService = { async mine() { return (await api.get("/library/me")).data.data; } };
