import { expect } from 'chai';
import request from 'supertest';
import app from '../src/index.js'; // Importuj instancję aplikacji Express

import axios from 'axios';
import * as sinon from 'sinon';

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

type AxiosPostMethod = typeof axios.post;

// let axiosPostStub: sinon.SinonStub<Parameters<AxiosPostMethod>, ReturnType<AxiosPostMethod>>;
let axiosPostStub: any

describe('Main API /requests Endpoint', () => {

    beforeEach(() => {
        axiosPostStub = sinon.stub(axios, 'post');
        ddbMock.reset()
        process.env.AWS_REGION = 'us-east-1';
        process.env.DYNAMODB_TABLE_NAME = 'MaintenanceRequests';
        process.env.ANALYSIS_SERVICE_URL = 'http://mock-analysis-service:3001';
    });

    afterEach(() => {
        axiosPostStub.restore();
        delete process.env.AWS_REGION;
        delete process.env.DYNAMODB_TABLE_NAME;
        delete process.env.ANALYSIS_SERVICE_URL;
    });

    describe('POST /requests', () => {
        it('should submit a new high priority request and return 201', async () => {
            axiosPostStub.resolves({
                data: {
                    keywords: ['leak', 'emergency'],
                    urgencyClassification: 'high',
                    priorityScore: 0.98,
                },
            });

            ddbMock.on(PutCommand).resolves({});

            const newRequest = {
                tenantId: 'test-tenant-123',
                message: 'Toilet is constantly leaking, it\'s an emergency!',
            };

            const response = await request(app)
                .post('/requests')
                .send(newRequest)
                .expect(201);

            expect(response.body).to.have.property('requestId').and.to.be.a('string');
            expect(response.body.priority).to.equal('high');
            expect(response.body.analyzedFactors.urgencyClassification).to.equal('high');
            expect(response.body.analyzedFactors.priorityScore).to.equal(0.98);

            expect(axiosPostStub.calledOnce).to.be.true;
            expect(axiosPostStub.firstCall.args[0]).to.include('/requests');

            expect(response.body).to.have.property('requestId').and.to.be.a('string');
            expect(response.body.priority).to.equal('high');

    
            expect(ddbMock.commandCalls(PutCommand).length).to.equal(1);
            expect(ddbMock.commandCalls(PutCommand)[0].args[0].input.TableName).to.equal('MaintenanceRequests');
        });

        it('should return 400 if tenantId is missing', async () => {
            const newRequest = {
                message: 'Broken window.',
            };

            const response = await request(app)
                .post('/requests')
                .send(newRequest)
                .expect(400);

            expect(response.body).to.have.property('error').and.include('tenantId is required');
            expect(axiosPostStub.called).to.be.false;
        });

        it('should return 400 if message is missing', async () => {
            const newRequest = {
                tenantId: 'test-tenant-123',
            };

            const response = await request(app)
                .post('/requests')
                .send(newRequest)
                .expect(400);

            expect(response.body).to.have.property('error').and.include('message is required');
            expect(axiosPostStub.called).to.be.false;
        });

        it('should return 500 if analysis service fails', async () => {
            axiosPostStub.rejects(new Error('Analysis service is down'));

            const newRequest = {
                tenantId: 'test-tenant-123',
                message: 'Test message for failure',
            };

            const response = await request(app)
                .post('/requests')
                .send(newRequest)
                .expect(500);

            expect(response.body).to.have.property('error').and.include('An error occurred');
            expect(axiosPostStub.calledOnce).to.be.true;
        });
    });
});