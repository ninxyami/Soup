import type { Metadata } from "next";
import { ReviewsView } from "@/components/reviews/Reviews";

export const metadata: Metadata = {
  title: "Reviews · State of Undead Purge",
  description: "What players say about our Project Zomboid server. The players' star score and their reviews, in their own words.",
};

export default function ReviewsPage() {
  return <ReviewsView />;
}
