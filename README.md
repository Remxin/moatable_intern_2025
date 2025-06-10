# moatable_intern_2025

## Author
- Dawid Nabagło

## Design
Project consists of 3 components
- local API (maintenance-api directory)
- DynamoDB for storing requests
- Lambda function with analytics-service code


## How to run project

### Setup (Required for both steps below!)
a) enter maintenance-api folder
```bash
cd maintenance-api
```

b) copy env.example file
```bash
cp env.example .env
```

c) paste provided credentials in .env file
```.env
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=MaintenanceRequests
PORT=3000

# Here paste provided credentials
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
ANALYSIS_SERVICE_URL=""
```

d) choose one of the options below

#### 1. With Docker (recommended) - works everywhere

- enter application root folder 
- enter this two commands
```bash
make docker-build
make docker-run
```

- if commands do not work you either are not in correct directory or not launched docker

#### 2. Locally
- enter maintenance-api folder
```bash
cd maintenance-api
```
- run command for installing all packages locally
```
npm install
```

- build project
```
npm run build
```
or
```
npx tsx
```
- launch project
```
npm run start
```
or
```
node dist/index.js
```

## Project structure
### Analytics Service
1. Logic placed inside analytics-service directory
2. index.ts file has all lambda function logic that I implemented and hosted on my lambda endpoint
3. deployment_package.zip is zipped package that can be uploaded directly on any lambda function with configured node environment

#### How it works
This service acts as a mock analysis endpoint for maintenance requests. It simulates an external AI by processing an incoming message and determining its urgency and extracting relevant keywords.


- Keyword Matching: It scans the message for terms indicating high, medium, or low priority, as well as urgency boosters.
- Urgency Classification: The message is classified as "high," "medium," or "low" based on the most severe keywords found. If no specific priority keywords are present, it defaults to general maintenance.
- Priority Score: An initial score is assigned based on the urgency classification (e.g., 0.9 for high). This score is then boosted by any urgency terms detected (e.g., "urgent," "ASAP"), capped at 1.0.
- Keyword Extraction: All identified keywords from the message are returned.
### Maintenance API
1. Local project that runs on port 3000

2. Can be accessed on http://localhost:3000

3. There are two endpoints:


a) GET /requests
- connects to dynamoDB and gets requests records
- can filter them by priority using for example:
```HTTP
 /requests?priority=high
 ```
 high can be replaced with **medium** or **low**

 - sorts received data by createdAt which is a timestamp

 - returns data to the user
 - example:

 Request Body: **none**

 Response:
 ```
 {
    "requests": [
        {
            "analyzedFactors": {
                "keywords": [
                    "leak",
                    "flood"
                ],
                "priorityScore": 0.9,
                "urgencyClassification": "high"
            },
            "resolved": false,
            "tenantId": "tenant-001",
            "priority": "high",
            "createdAt": "2025-06-10T18:04:28.821Z",
            "message": "The water heater is leaking badly in the bathroom, it's flooding!",
            "id": "cd49d9d8-a420-4546-95e6-e1f1d6553b45"
        }
    ]
}
```

b) POST /requests

- validetes parameters
- invokes lambda function for message analytics
- processes lambda function response 
- saves record in dynamoDB database
- example:

Request Body
```
{
  "tenantId": "tenant-001",
  "message": "The water heater is leaking badly in the bathroom, it's flooding!"
}
```

Response
```
{
    "requestId": "85d25c4d-3db5-485f-bb16-71d40927cfce",
    "priority": "high",
    "analyzedFactors": {
        "keywords": [
            "leak",
            "flood"
        ],
        "urgencyClassification": "high",
        "priorityScore": 0.9
    }
}
```