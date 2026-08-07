"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type FinalReportPhoto = {
  id: string;
  photo_category: string | null;
  photo_url: string;
  photo_path: string | null;
  file_name: string | null;
  caption: string | null;
  sort_order: number | null;
  created_at: string | null;
};

type FinalReportPhotosInlineProps = {
  recordId: string;
  category: "instrument" | "test_phase";
  title: string;
  variant?: "default" | "clean-large";
};

function normalizeCategory(value: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function isMatchingCategory(
  photo: FinalReportPhoto,
  category: "instrument" | "test_phase"
) {
  const normalized = normalizeCategory(photo.photo_category);

  if (category === "instrument") {
    if (!normalized) {
      return true;
    }

    return (
      normalized === "instrument" ||
      normalized === "instrument_photo" ||
      normalized === "strumento" ||
      normalized === "foto_strumento" ||
      normalized.includes("strumento")
    );
  }

  return (
    normalized === "test_phase" ||
    normalized === "fase_prova" ||
    normalized === "fasi_prova" ||
    normalized === "prova" ||
    normalized.includes("fase")
  );
}

export default function FinalReportPhotosInline({
  recordId,
  category,
  title,
  variant = "default",
}: FinalReportPhotosInlineProps) {
  const [photos, setPhotos] = useState<FinalReportPhoto[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadPhotos() {
      const { data } = await supabase
        .from("calibration_report_photos")
        .select(
          "id, photo_category, photo_url, photo_path, file_name, caption, sort_order, created_at"
        )
        .eq("calibration_record_id", recordId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!isMounted) {
        return;
      }

      const filteredPhotos = ((data ?? []) as FinalReportPhoto[]).filter((photo) =>
        isMatchingCategory(photo, category)
      );

      setPhotos(filteredPhotos);
    }

    loadPhotos();

    return () => {
      isMounted = false;
    };
  }, [recordId, category]);

  if (photos.length === 0) {
    return null;
  }

  if (variant === "clean-large") {
    return (
      <div className="mt-4 break-inside-avoid">
        <h3 className="mb-2 text-[12px] font-black uppercase">{title}</h3>

        <div className="flex w-full justify-center">
          <img
            src={photos[0].photo_url}
            alt={photos[0].caption || photos[0].file_name || title}
            className="max-h-[360px] w-auto max-w-full object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 break-inside-avoid">
      <h3 className="mb-2 text-[12px] font-black uppercase">{title}</h3>

      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo, index) => (
          <figure
            key={photo.id || String(index)}
            className="break-inside-avoid rounded-sm border border-slate-300 bg-white/70 p-2"
          >
            <div className="flex h-[190px] items-center justify-center border border-slate-200 bg-white">
              <img
                src={photo.photo_url}
                alt={photo.caption || photo.file_name || title}
                className="h-full w-full object-contain"
              />
            </div>

            <figcaption className="mt-1 text-center text-[8.5px] leading-tight text-slate-800">
              {photo.caption || photo.file_name || title}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
