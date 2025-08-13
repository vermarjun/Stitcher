import { atom } from "recoil";

export const activeMenuState = atom<string>({
  key: "activeMenuState",
  default: "",
});