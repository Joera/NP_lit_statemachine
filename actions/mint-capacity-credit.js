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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MintCapacityCreditAction = void 0;
const action_1 = require("./action");
class MintCapacityCreditAction extends action_1.Action {
    constructor(params) {
        const mintPkpFunction = () => __awaiter(this, void 0, void 0, function* () {
            const capacityCreditNFT = yield params.stateMachine.litContracts.mintCapacityCreditsNFT({
                requestsPerSecond: params.requestPerSecond,
                daysUntilUTCMidnightExpiration: params.daysUntilUTCMidnightExpiration,
            });
            const capacityTokeId = capacityCreditNFT.capacityTokenIdStr;
            params.debug && console.log(`Minted PKP: ${capacityTokeId}`);
            params.stateMachine.setToContext(`activeCapacityTokenId`, capacityTokeId);
        });
        super({
            debug: params.debug,
            function: mintPkpFunction,
        });
    }
}
exports.MintCapacityCreditAction = MintCapacityCreditAction;
