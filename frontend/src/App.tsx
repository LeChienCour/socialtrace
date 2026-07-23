import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface HealthResponse {
  status: string;
}

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/healthz");
  if (!response.ok) {
    throw new Error(`unexpected status ${response.status}`);
  }
  return response.json();
}

function App() {
  const { data, isError, isPending } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  const apiStatus = isPending
    ? "checking..."
    : isError
      ? "API: unreachable"
      : `API: ${data.status}`;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-medium">socialtrace</h1>
      <p data-testid="api-status">{apiStatus}</p>
      <Button>Placeholder</Button>
    </div>
  );
}

export default App;
