import { publicationAbi } from "./abi";
import { evmWrite } from "./evm";

const go = async () => {  

  const pkpPublicKey = "04554f0e5e94819716659425fbe1d3de01449afe5dc2185ae2ac7ac31e3d75e22b4dce97e702a0d2210db2ca1c43f05836de11a71f9625a6c8d48c14c154b90ff0";
  const tokenId = "0xab00ba789537484d7a597961a1c0921acf9cfa923f948b37c69612a82f20ab9f";
  const contractAddress = "0x1e00a4d85cb0a58b48e3007f0e1d20b6621e78ed";

  const permittedActions = await Lit.Actions.getPermittedActions({ tokenId });
  const permittedAuthMethods = await Lit.Actions.getPermittedAuthMethods({ tokenId });
  console.log('Permitted actions:', permittedActions);
  permittedAuthMethods.forEach((method: { auth_method_type: string, id: string, user_pubkey: string }, i: number) => {
    console.log(`  ${i + 1}. Auth Method:`);
    console.log(`     Type: ${method.auth_method_type}`);
    console.log(`     ID: ${method.id}`);
    console.log(`     Public Key: ${method.user_pubkey}`);
  });
  

  let receipt = await evmWrite(
    pkpPublicKey,
    contractAddress,
    publicationAbi
  );

  Lit.Actions.setResponse({ response: receipt.transactionHash});


};

go();