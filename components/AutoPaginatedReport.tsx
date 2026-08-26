"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

type AutoPaginatedReportProps = {
  children: ReactNode;
  letterheadSrc: string;
  reportNumber: string;
  reportDateLabel: string;
};

function cloneFlowBlock(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  const styles = window.getComputedStyle(element);

  // Flow blocks are extracted from their original section. Preserve the
  // inherited typography and the spacing produced by parent selectors;
  // otherwise 12/13 px report text falls back to the browser's 16 px default.
  clone.style.fontFamily = styles.fontFamily;
  clone.style.fontSize = styles.fontSize;
  clone.style.fontWeight = styles.fontWeight;
  clone.style.lineHeight = styles.lineHeight;
  clone.style.letterSpacing = styles.letterSpacing;
  clone.style.textAlign = styles.textAlign;
  clone.style.color = styles.color;
  clone.style.marginTop = styles.marginTop;
  clone.style.marginBottom = styles.marginBottom;

  return clone;
}

export default function AutoPaginatedReport({
  children,
  letterheadSrc,
  reportNumber,
  reportDateLabel,
}: AutoPaginatedReportProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let cancelled = false;

    async function paginate() {
      const source = sourceRef.current;
      const output = outputRef.current;
      if (!source || !output) return;
      const outputElement = output;

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const images = Array.from(source.querySelectorAll("img"));
      await Promise.all(
        images.map(
          (image) =>
            image.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  image.addEventListener("load", () => resolve(), { once: true });
                  image.addEventListener("error", () => resolve(), { once: true });
                })
        )
      );

      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve())
      );

      if (cancelled) return;

      const blocks = Array.from(
        source.querySelectorAll<HTMLElement>("[data-report-flow-block]")
      );
      source
        .querySelectorAll<HTMLElement>(".report-a4-page")
        .forEach((page) => {
          page.dataset.reportMeasurementPage = "true";
        });
      outputElement.replaceChildren();
      outputElement.className = "block space-y-8 print:space-y-0";

      function createPage() {
        const page = document.createElement("section");
        page.className =
          "report-a4-page relative mx-auto h-[297mm] min-h-[297mm] w-[210mm] overflow-hidden bg-white shadow-lg ring-1 ring-slate-200 print:shadow-none print:ring-0";
        page.dataset.autoPaginatedPage = "true";
        page.style.breakBefore = "page";
        page.style.pageBreakBefore = "always";

        const letterhead = document.createElement("img");
        letterhead.src = letterheadSrc;
        letterhead.alt = "Carta intestata Tecnocontrolli";
        letterhead.className =
          "pointer-events-none absolute inset-0 z-0 block h-full w-full object-fill print:block";

        // The footer owns everything below 104 px from the bottom. Because the
        // content has real top/bottom edges, scrollHeight is a reliable overflow
        // test and no report block can be rendered over the footer.
        const content = document.createElement("div");
        content.className =
          "auto-report-content absolute left-[60px] right-[60px] top-[152px] bottom-[72px] z-10 overflow-hidden text-[12px] leading-[1.35]";

        const footer = document.createElement("div");
        footer.className =
          "absolute bottom-[28px] left-[60px] right-[60px] z-10 border-t border-slate-300 pt-2 text-center text-[10px] leading-tight text-slate-700";
        footer.innerHTML =
          '<p>Pagina <span data-report-page-number></span> di <span data-report-total-pages></span> del Rapporto di Prova ' +
          reportNumber +
          " del " +
          reportDateLabel +
          "</p><p>È vietata la riproduzione del rapporto di prova o di singole parti senza l'approvazione del laboratorio Tecnocontrolli S.r.l.</p>";

        page.append(letterhead, content, footer);
        outputElement.appendChild(page);
        return { page, content };
      }

      let current = createPage();
      let currentBlockCount = 0;

      for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        const flowGroup = block.dataset.reportFlowGroup;
        const groupedBlocks = [block];

        if (flowGroup) {
          while (
            blocks[index + groupedBlocks.length]?.dataset.reportFlowGroup ===
            flowGroup
          ) {
            groupedBlocks.push(blocks[index + groupedBlocks.length]);
          }
        }

        if (
          !flowGroup &&
          block.dataset.reportKeepWithNext === "true" &&
          blocks[index + groupedBlocks.length]
        ) {
          groupedBlocks.push(blocks[index + groupedBlocks.length]);
        }
        const forceNewPage = block.dataset.reportPageBreakBefore === "true";

        if (forceNewPage && currentBlockCount > 0) {
          current = createPage();
          currentBlockCount = 0;
        }

        const clones = groupedBlocks.map(cloneFlowBlock);
        clones.forEach((clone) => current.content.appendChild(clone));

        const overflows =
          current.content.scrollHeight > current.content.clientHeight + 1;

        if (overflows && currentBlockCount > 0) {
          clones.forEach((clone) => clone.remove());
          current = createPage();
          currentBlockCount = 0;
          clones.forEach((clone) => current.content.appendChild(clone));
        }

        currentBlockCount += groupedBlocks.length;
        index += groupedBlocks.length - 1;
      }

      const visiblePages = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".report-a4-page:not([data-report-measurement-page])"
        )
      );
      const totalPages = visiblePages.length;

      // Number each real page according to its actual position after automatic
      // pagination. The hidden measurement pages are deliberately excluded.
      visiblePages.forEach((page, index) => {
        page
          .querySelectorAll<HTMLElement>("[data-report-page-number]")
          .forEach((element) => {
            element.textContent = String(index + 1);
          });
      });

      // IMPORTANT: update the total globally, not only inside the pages walked
      // above. This also updates the total written in the cover text and keeps
      // cover + every footer tied to the exact same real page count.
      document
        .querySelectorAll<HTMLElement>("[data-report-total-pages]")
        .forEach((element) => {
          element.textContent = String(totalPages);
        });
    }

    void paginate();

    return () => {
      cancelled = true;
    };
  }, [children, letterheadSrc, reportDateLabel, reportNumber]);

  return (
    <>
      <div
        ref={sourceRef}
        data-report-measurement-page="true"
        aria-hidden="true"
        className="pointer-events-none fixed left-[-100000px] top-0 w-[210mm] opacity-0 print:hidden"
      >
        {children}
      </div>

      <div ref={outputRef} className="hidden" />
    </>
  );
}