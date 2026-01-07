"use client";

export const LoadingSkeleton = () => {
  return (
    <section className="mt-8 surface rounded-xl p-5 md:p-6 lg:p-7">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-6 w-24 rounded bg-white/10" />
          </div>
          <div className="h-6 w-20 rounded-full bg-white/10" />
        </div>

        {/* Description skeleton */}
        <div className="mt-2 h-4 w-3/4 rounded bg-white/10" />

        {/* Transaction cards skeleton */}
        <ol className="mt-6 space-y-4">
          {/* Initial transaction skeleton */}
          <li className="relative">
            <div className="absolute left-3 top-3 -ml-px h-[calc(100%+1rem)] w-px bg-white/10 md:left-3.5" />
            <div className="relative pl-10 md:pl-12">
              <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 ring-2 ring-blue-500/30">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              </div>
              <div className="rounded-lg border border-white/10 bg-white/60 dark:bg-white/5 p-4 md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-5 w-32 rounded bg-white/10" />
                  <div className="h-5 w-16 rounded-full bg-white/10" />
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <div className="h-3 w-16 rounded bg-white/10" />
                    <div className="h-4 w-24 rounded bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-12 rounded bg-white/10" />
                    <div className="h-4 w-16 rounded bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-14 rounded bg-white/10" />
                    <div className="h-4 w-full rounded bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded bg-white/10" />
                    <div className="h-4 w-full rounded bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          </li>

          {/* Validation transaction skeleton */}
          <li className="relative">
            <div className="absolute left-3 top-3 -ml-px h-[calc(100%+1rem)] w-px bg-white/10 md:left-3.5" />
            <div className="relative pl-10 md:pl-12">
              <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 ring-2 ring-indigo-500/30">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
              </div>
              <div className="rounded-lg border border-white/10 bg-white/60 dark:bg-white/5 p-4 md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-5 w-32 rounded bg-white/10" />
                  <div className="h-5 w-16 rounded-full bg-white/10" />
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded bg-white/10" />
                    <div className="h-4 w-full rounded bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-20 rounded bg-white/10" />
                    <div className="h-4 w-32 rounded bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          </li>

          {/* Execute transaction skeleton */}
          <li className="relative">
            <div className="relative pl-10 md:pl-12">
              <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 ring-2 ring-green-500/30">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <div className="rounded-lg border border-white/10 bg-white/60 dark:bg-white/5 p-4 md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-5 w-36 rounded bg-white/10" />
                  <div className="h-5 w-16 rounded-full bg-white/10" />
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <div className="h-3 w-16 rounded bg-white/10" />
                    <div className="h-4 w-24 rounded bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-12 rounded bg-white/10" />
                    <div className="h-4 w-16 rounded bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-16 rounded bg-white/10" />
                    <div className="h-4 w-full rounded bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded bg-white/10" />
                    <div className="h-4 w-full rounded bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
};
