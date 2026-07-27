"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ReportPhotoCategory = "instrument" | "test_phase";

type ReportPhoto = {
  id: string;
  calibration_record_id: string;
  photo_category: ReportPhotoCategory | string | null;
  photo_url: string;
  photo_path: string | null;
  file_name: string | null;
  caption: string | null;
  sort_order: number | null;
  created_at: string | null;
};

type FinalReportPhotosInlineProps = {
  recordId: string;
  category: ReportPhotoCategory;
  title: string;
};

function isTestPhasePhoto(photo: ReportPhoto) {
  const category = String(photo.photo_category ?? "").trim().toLowerCase();

  return (
    category === "test_phase" ||
    category === "fase_prova" ||
    category === "fasi_prova" ||
    category === "prova" ||
    category.includes("fase")
  );
}

function isInstrumentPhoto(photo: ReportPhoto) {
  const category = String(photo.photo_category ?? "").trim().toLowerCase();

  if (!category) {
    return true;
  }

  return (
    category === "instrument" ||
    category === "instrument_photo" ||
    category === "strumento" ||
    category === "foto_strumento" ||
    category.includes("strumento")
  );
}

export default function FinalReportPhotosInline({
  recordId,
  category,
  title,
}: FinalReportPhotosInlineProps) {
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPhotos() {
      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("calibration_report_photos")
        .select(
          "id, calibration_record_id, photo_category, photo_url, photo_path, file_name, caption, sort_order, created_at"
        )
        .eq("calibration_record_id", recordId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        setPhotos([]);
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setPhotos((data ?? []) as ReportPhoto[]);
      setIsLoading(false);
    }

    void loadPhotos();

    return () => {
      isMounted = false;
    };
  }, [recordId]);

  const filteredPhotos = useMemo(() => {
    if (category === "test_phase") {
      return photos.filter(isTestPhasePhoto);
    }

    return photos.filter((photo) => isInstrumentPhoto(photo) || !isTestPhasePhoto(photo));
  }, [category, photos]);

  if (isLoading) {
    return (
      <div className="print-hidden mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-900">
        Caricamento foto rapporto...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="print-hidden mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-900">
        Errore caricamento foto rapporto: {errorMessage}
      </div>
    );
  }

  if (filteredPhotos.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 break-inside-avoid">
      <h3 className="mb-2 text-[12px] font-black uppercase">{title}</h3>

      <div className="grid grid-cols-2 gap-3">
        {filteredPhotos.map((photo, index) => (
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
