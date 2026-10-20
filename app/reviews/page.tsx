import type { Metadata } from "next";
import { ReviewsView } from "@/components/reviews/Reviews";

export const metadata: Metadata = {
  title: "Reviews · State of Undead Purge",
  description: "What players say about our Project Zomboid server. Star ratings and reviews from the people who play here.",
};

export default function ReviewsPage() {
  return <ReviewsView />;
}
