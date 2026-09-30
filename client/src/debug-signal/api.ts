const API_BASE_URL = "http://localhost:5000";

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}export async function getRepositoryInfo(): Promise<{
  repository: string;
  branch: string;
}> {
  const response = await fetch(
    `${API_BASE_URL}/api/repository/info`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch repository info");
  }

  const data = await response.json();

  return data.data;
}

export async function getRecentCommits(): Promise<GitCommit[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/repository/commits`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch repository commits");
  }

  const data = await response.json();

  return data.data;
}

export async function searchCommits(
  query: string
): Promise<GitCommit[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/repository/commits/search?query=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error("Failed to search repository commits");
  }

  const data = await response.json();

  return data.data;
}

export async function investigate(
  query: string
) {
  console.log("🚨 SENDING INVESTIGATION TO BACKEND:", query);

  const response = await fetch(
    `${API_BASE_URL}/api/investigation/investigate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    throw new Error("Investigation failed");
  }

  const data = await response.json();

  console.log("🚨 BACKEND INVESTIGATION RESPONSE:", data);

  return data.data;
}
export async function getVoiceToken(): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/voice/token`
  );

  if (!response.ok) {
    throw new Error("Failed to get voice token");
  }

  const data = await response.json();

  return data.data.token;
}