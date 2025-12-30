import { Calendar, Trophy, IndianRupee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStats } from "@/hooks/useEvents";

export function StatsCards() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    {
      label: "Total Events",
      value: stats?.total ?? 0,
      icon: Calendar,
      color: "text-blue-500",
    },
    {
      label: "Upcoming",
      value: stats?.upcoming ?? 0,
      icon: Trophy,
      color: "text-green-500",
    },
    {
      label: "With Prize Info",
      value: stats?.withPrize ?? 0,
      icon: IndianRupee,
      color: "text-amber-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full bg-secondary p-3 ${item.color}`}>
                <item.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{item.value.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
