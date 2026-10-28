import { contextBridge, ipcRenderer } from "electron";
import { IPC, type DeskDogApi } from "./api";

const api: DeskDogApi = {
  init: () => ipcRenderer.invoke(IPC.init),
  setHit: (hit) => ipcRenderer.send(IPC.setHit, hit),
  pointer: (event) => ipcRenderer.send(IPC.pointer, event),
  onOutput: (listener) => {
    ipcRenderer.on(IPC.output, (_event, output) => listener(output));
  },
};

contextBridge.exposeInMainWorld("deskdog", api);
