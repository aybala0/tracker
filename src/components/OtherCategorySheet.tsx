import { useState } from "react";
import type { DefineCategoryKind } from "../types";

type Props = {
  desc: string;
  onClose: () => void;
};

/** Bottom sheet asking whether "Other" should become a new major or minor category. */
export function OtherCategorySheet({ desc, onClose }: Props) {
  const [defKind, setDefKind] = useState<DefineCategoryKind | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,.45)" }}
    >
      <div className="pb-[30px] pt-[22px]" style={{ background: "#fff", borderTop: "2px solid #000" }}>
        <div className="mx-auto mb-[18px]" style={{ width: 44, height: 4, background: "#000" }} />
        <div
          className="mb-2 uppercase px-[22px]"
          style={{ font: "900 24px/1.05 Archivo", letterSpacing: "-.03em" }}
        >
          Define a
          <br />
          category?
        </div>
        <div className="mb-[18px] px-[22px]" style={{ font: "500 13px/1.45 Archivo", color: "rgba(0,0,0,.65)" }}>
          &ldquo;{desc}&rdquo; has no home yet. Give it one, or leave it in Other.
        </div>
        <div className="flex flex-col gap-2.5 px-[22px]">
          <div
            onClick={() => setDefKind("major")}
            className="cursor-pointer p-[14px_15px]"
            style={{ border: "2px solid #000", background: defKind === "major" ? "#F2DC5D" : "#fff", padding: "14px 15px" }}
          >
            <div style={{ font: "800 15px Archivo", letterSpacing: "-.01em" }}>Major category</div>
            <div style={{ font: "500 12px Archivo", color: "rgba(0,0,0,.65)" }}>
              Joins the ten defaults, gets its own color and slice
            </div>
          </div>
          <div
            onClick={() => setDefKind("minor")}
            className="cursor-pointer"
            style={{ border: "2px solid #000", background: defKind === "minor" ? "#F2DC5D" : "#fff", padding: "14px 15px" }}
          >
            <div style={{ font: "800 15px Archivo", letterSpacing: "-.01em" }}>Minor category</div>
            <div style={{ font: "500 12px Archivo", color: "rgba(0,0,0,.65)" }}>A subcategory under Other</div>
          </div>
          <input
            placeholder="Name it — e.g. Theatre"
            className="mt-0.5 w-full"
            style={{ height: 46, border: "2px solid #000", padding: "0 12px", font: "600 14px Archivo" }}
          />
          <div className="mt-1 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 grid place-items-center uppercase"
              style={{ height: 46, border: "2px solid #000", font: "800 12px Archivo", letterSpacing: ".06em" }}
            >
              Leave in Other
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 grid place-items-center uppercase"
              style={{ height: 46, background: "#F2188F", color: "#fff", font: "800 12px Archivo", letterSpacing: ".06em" }}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
