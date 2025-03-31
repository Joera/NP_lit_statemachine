async function monitorEthereumBlocksWithHashEndingWithZero() {
    const litNodeClient = new LitNodeClient({
      litNetwork: 'datil-dev',
    });
    const litContracts = new LitContracts({
      network: 'datil-dev',
    });
    const stateMachine = new StateMachine({
      // When the machine doesn't mint nor use Lit, these values do not matter
      privateKey: 'NOT_USED',
      litNodeClient,
      litContracts,
    });
    // const stateMachine = StateMachine.fromDefinition({...}) also works to extend a base definition
  
    // Add each state individually
    stateMachine.addState({
      key: 'listenBlocks',
      onEnter: async () =>
        console.log('Waiting for a block with a hash ending in 0'),
      onExit: async () => console.log('Found a block whose hash ends in 0!'),
    });
    stateMachine.addState({
      key: 'autoAdvancingState',
    });
  
    // Then add transitions between states
    stateMachine.addTransition({
      // Because this transition does not have any listeners, it will be triggered automatically when the machine enters fromState
      fromState: 'autoAdvancingState',
      toState: 'listenBlocks',
    });
    stateMachine.addTransition({
      fromState: 'listenBlocks',
      toState: 'autoAdvancingState',
      // listeners are the ones that will produce the values that the transition will monitor
      listeners: [new EVMBlockListener(LIT_EVM_CHAINS.ethereum.rpcUrls[0])],
      // check is the function that will evaluate all values produced by listeners and define if there is a match or not
      check: async (values): Promise<boolean> => {
        // values are the results of all listeners
        const blockData = values[0] as BlockData;
        if (!blockData) return false;
        console.log(`New block: ${blockData.number} (${blockData.hash})`);
        return blockData.hash.endsWith('0');
      },
      // when check finds a match (returns true) this function gets executed and the machine moves to toState
      onMatch: async (values) => {
        // values are the results of all listeners
        console.log('We have matching values here');
      },
      onMismatch: undefined, // when check returns false (there is a mismatch) this function gets executed but the machine does not change state
      onError: undefined,
    });
  
    await stateMachine.startMachine('listenBlocks');
  }
  monitorEthereumBlocksWithHashEndingWithZero().catch(console.error);