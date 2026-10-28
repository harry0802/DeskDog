import type { DeskDogApi } from "../../preload/api";

declare global {
  interface Window {
    readonly deskdog: DeskDogApi;
  }
}
