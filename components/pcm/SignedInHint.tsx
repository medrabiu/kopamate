"use client";

import { useEffect } from "react";
import { loadMyPlan } from "@/app/actions/pcm";

/** On cached checklist pages: marks <html data-signed-in> for signed-in people, so the header shows "Open the app". */
export default function SignedInHint() {
  useEffect(() => {
    loadMyPlan()
      .then((me) => {
        if (me.signedIn) document.documentElement.dataset.signedIn = "1";
      })
      .catch(() => {});
  }, []);
  return null;
}
