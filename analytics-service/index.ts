import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

function analyzeMessage(message: string) {
  const msgLower = message.toLowerCase();
  const keywords: string[] = [];

  const highPriorityTerms = [
    "leak", "flood", "burst", "sewage",
    "sparking", "power outage", "exposed wires",
    "broken window", "roof leak",
    "gas leak", "smoke detector", "no heat", "frozen pipes"
  ];

  const mediumPriorityTerms = [
    "broken appliance", "appliance", "stuck door", "noisy equipment",
    "noisy", "malfunction", "fridge not working"
  ];

  const lowPriorityTerms = [
    "cosmetic", "paint", "touch-up", "squeaky hinge", "minor repair"
  ];

  const urgencyBoosters = [
    "urgent", "immediately", "asap", "emergency", "right away", "now"
  ];

  let urgencyClassification: "high" | "medium" | "low" = "low";

  const matchFromList = (terms: string[]) => {
      const matched = new Set<string>();
      terms.forEach(term => {
          if (msgLower.includes(term)) {
              matched.add(term);
          }
      });
      return Array.from(matched);
  }


  const highMatches = matchFromList(highPriorityTerms);
  const mediumMatches = matchFromList(mediumPriorityTerms);
  const lowMatches = matchFromList(lowPriorityTerms);
  const boosterMatches = matchFromList(urgencyBoosters);

  if (highMatches.length > 0) {
    urgencyClassification = "high";
    keywords.push(...highMatches);
  } else if (mediumMatches.length > 0) {
    urgencyClassification = "medium";
    keywords.push(...mediumMatches);
  } else if (lowMatches.length > 0) {
    urgencyClassification = "low";
    keywords.push(...lowMatches);
  } else {
    keywords.push("general_maintenance");
  }

  if (boosterMatches.length > 0) {
    keywords.push(...boosterMatches);
  }

  let priorityScore =
    urgencyClassification === "high" ? 0.9 :
    urgencyClassification === "medium" ? 0.5 : 0.2;

  const boosterScore = boosterMatches.length * 0.05;
  priorityScore = Math.min(1.0, priorityScore + boosterScore); 

  const uniqueKeywords = [...new Set(keywords)];

  return {
    keywords: uniqueKeywords,
    urgencyClassification,
    priorityScore: Number(priorityScore.toFixed(2))
  };
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    if (event.requestContext.http.method !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Only POST requests are allowed for analysis.' }),
        };
    }

    let requestBody;
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: "Request body is missing." }),
            };
        }
        requestBody = JSON.parse(event.body);
    } catch (error) {
        console.error("Failed to parse request body:", error);
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: "Invalid JSON in request body." }),
        };
    }

    const message = requestBody.message;

    if (typeof message !== "string" || !message) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: "Field 'message' is required and must be a non-empty string." }),
        };
    }

    const result = analyzeMessage(message);

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
    };
};