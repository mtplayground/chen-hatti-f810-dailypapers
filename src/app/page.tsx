import { HomeContent } from "@/components/home-content";
import { getDashboardData } from "@/services/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dashboard = await getDashboardData();

  return <HomeContent dashboard={dashboard} />;
}
