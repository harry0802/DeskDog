import { contextBridge, ipcRenderer } from "electron";
import { IPC, type DeskDogApi } from "./api";

const api: DeskDogApi = {
  init: () => ipcRenderer.invoke(IPC.init),
  setHit: (hit) => ipcRenderer.send(IPC.setHit, hit),
};

contextBridge.exposeInMainWorld("deskdog", api);
