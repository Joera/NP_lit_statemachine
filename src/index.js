"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const event_listener_1 = require("@lit-protocol/event-listener");
const contracts_sdk_1 = require("@lit-protocol/contracts-sdk");
const lit_node_client_1 = require("@lit-protocol/lit-node-client");
const constants_1 = require("@lit-protocol/constants");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
function monitorContractEvents() {
    return __awaiter(this, void 0, void 0, function* () {
        const litNodeClient = new lit_node_client_1.LitNodeClient({
            litNetwork: 'datil-dev',
        });
        const litContracts = new contracts_sdk_1.LitContracts({
            network: 'datil-dev',
        });
        const stateMachine = new event_listener_1.StateMachine({
            privateKey: 'NOT_USED',
            litNodeClient,
            litContracts,
        });
        const contractABI = [
            "event NPublish(address indexed author, address indexed publication, string cid)"
        ];
        const contractInfo = {
            address: process.env.NPRINTER_ADDRESS || "",
            abi: contractABI,
        };
        console.log('Available chains:', constants_1.LIT_CHAINS);
        console.log('Base Sepolia chain:', constants_1.LIT_CHAINS['baseSepoliaTestnet']);
        // Log chain info
        const baseSepoliaChain = {
            name: 'Base Sepolia',
            rpcUrls: [`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`],
            chainId: 84532,
        };
        console.log('Using chain:', baseSepoliaChain);
        const eventInfo = {
            name: 'NPublish'
        };
        const contractListener = new event_listener_1.EVMContractEventListener(baseSepoliaChain.rpcUrls[0], contractInfo, eventInfo);
        // Add states to the state machine
        stateMachine.addState({
            key: 'listenEvents',
            onEnter: () => __awaiter(this, void 0, void 0, function* () { return console.log('Started listening for NPublish events'); }),
            onExit: () => __awaiter(this, void 0, void 0, function* () { return console.log('Processing NPublish event!'); }),
        });
        stateMachine.addState({
            key: 'processEvent',
        });
        // Add transition that listens for events
        stateMachine.addTransition({
            fromState: 'listenEvents',
            toState: 'processEvent',
            listeners: [contractListener],
            check: (values) => __awaiter(this, void 0, void 0, function* () {
                const event = values[0];
                if (!event)
                    return false;
                console.log('New NPublish event:', {
                    author: event.args.author,
                    publication: event.args.publication,
                    cid: event.args.cid
                });
                return true; // Process all events
            }),
            onMatch: (values) => __awaiter(this, void 0, void 0, function* () {
                const event = values[0];
                // Handle the event here
                console.log('Processing NPublish event:', event.args.cid);
            })
        });
        // Add transition back to listening state
        stateMachine.addTransition({
            fromState: 'processEvent',
            toState: 'listenEvents',
            listeners: [],
            check: () => __awaiter(this, void 0, void 0, function* () { return true; })
        });
        // Start the state machine
        yield stateMachine.startFrom('listenEvents');
    });
}
monitorContractEvents().catch(console.error);
