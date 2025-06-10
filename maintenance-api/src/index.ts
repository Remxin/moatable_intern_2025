import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from "express";
import axios, { isAxiosError } from "axios";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

const AWS_REGION = process.env.AWS_REGION || "us-east-1"
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "MaintenanceRequests";
const ANALYSIS_SERVICE_URL = process.env.ANALYSIS_SERVICE_URL;
const PORT = process.env.PORT || 3000;

if (!ANALYSIS_SERVICE_URL) {
  console.error("Error: ANALYSIS_SERVICE_URL environment variable is not set. Please ensure .env file is correct.");
  process.exit(1);
}

const dbClient = new DynamoDBClient({ region: AWS_REGION });
const dbDocClient = DynamoDBDocumentClient.from(dbClient);

interface AnalysisResult {
  keywords: string[];
  urgencyClassification: "high" | "medium" | "low";
  priorityScore: number;
}

interface MaintenanceRequest {
  id: string;
  tenantId: string;
  message: string;
  createdAt: string;
  priority: "high" | "medium" | "low";
  resolved: boolean;
  analyzedFactors: AnalysisResult;
}

app.post("/requests", async (req: Request, res: Response): Promise<void> => { // Dodano jawny typ zwracany Promise<void>
  const { tenantId, message } = req.body;

  if (typeof tenantId !== "string" || !tenantId.trim()) {
    res.status(400).json({ error: "tenantId is required and must be a non-empty string." });
    return;
  }
  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required and must be a non-empty string." });
    return;
  }

  const newRequestId = uuidv4();
  const createdAt = new Date().toISOString();

  try {
  
    const analysisResponse = await axios.post<AnalysisResult>(ANALYSIS_SERVICE_URL + "/requests", { message });
    const analysisResult = analysisResponse.data;


    let finalPriority: "high" | "medium" | "low";
    if (analysisResult.urgencyClassification === "high" || analysisResult.priorityScore >= 0.7) {
      finalPriority = "high";
    } else if (analysisResult.urgencyClassification === "medium" || analysisResult.priorityScore >= 0.4) {
      finalPriority = "medium";
    } else {
      finalPriority = "low";
    }

    const newRequest: MaintenanceRequest = {
      id: newRequestId,
      tenantId: tenantId,
      message: message,
      createdAt: createdAt,
      priority: finalPriority,
      resolved: false,
      analyzedFactors: analysisResult,
    };
        console.log(newRequest)

    const putCommand = new PutCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: newRequest,
    });
    await dbDocClient.send(putCommand);

    console.log(`Request ${newRequestId} saved with priority: ${finalPriority}.`);

    res.status(201).json({
      requestId: newRequest.id,
      priority: newRequest.priority,
      analyzedFactors: newRequest.analyzedFactors,
    });

  } catch (error: any) {
    console.error("Error processing request:", error);
    if (isAxiosError(error) && error.response) {
      console.error("Analysis service error details (response):", error.response.status, error.response.data);
    }
    res.status(500).json({ error: "An error occurred while processing the request. Please try again." });
  }
});

app.get("/requests", async (req: Request, res: Response): Promise<void> => {
  const { priority } = req.query;

  try {
    let requests: MaintenanceRequest[] = [];

    if (priority) {
      const validPriorities = ["high", "medium", "low"];
      if (typeof priority !== "string" || !validPriorities.includes(priority.toLowerCase())) {
        res.status(400).json({ error: "Invalid 'priority' query parameter. Must be 'high', 'medium', or 'low'." });
        return; 
      }

      const queryCommand = new QueryCommand({
        TableName: DYNAMODB_TABLE_NAME,
        IndexName: "PriorityIndex",
        KeyConditionExpression: "#p = :priorityValue",
        ExpressionAttributeNames: { "#p": "priority" },
        ExpressionAttributeValues: { ":priorityValue": priority.toLowerCase() },
      });
      const data = await dbDocClient.send(queryCommand);
      requests = (data.Items as MaintenanceRequest[]) || [];
    } else {
      const scanCommand = new ScanCommand({
        TableName: DYNAMODB_TABLE_NAME,
      });
      const data = await dbDocClient.send(scanCommand);
      requests = (data.Items as MaintenanceRequest[]) || [];
    }

    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({ requests: requests });

  } catch (error: any) {
    console.error("Error retrieving requests:", error);
    res.status(500).json({ error: "An error occurred while retrieving requests." });
  }
});

app.listen(PORT, () => {
  console.log(`Local API service running on port ${PORT}`);
  console.log(ANALYSIS_SERVICE_URL)
  console.log(`POST /requests endpoint available at: http://localhost:${PORT}/requests`);
  console.log(`GET /requests endpoint available at: http://localhost:${PORT}/requests?priority=high (or without parameter)`);
});
