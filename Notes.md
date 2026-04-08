Chaptor 73 ---

Please carry out comprehensive research and write 3 documents to the planning directory. Research the API from the Massive    
  (formerly Polygon.io) for retrieving realtime and end of day prices for multiple tickers; write documentation with code examples  
  in MASSIVE_API.md. Use that to design the unified Python API that we should use in this project for retrieving stock prices that  
  uses the Massive API if MASSIVE_API_KEY is set otherwise uses a simulator; document this in MARKET_INTERFACE.md. Finally,         
  document the approach for the simulator in MARKET_SIMULATOR.md; this is the approach and code structure for simulating stock      
  prices.   

  Chapter 74 prompt
  Please read all the documents in the planning directory. Then design the market data backend in details. Write a new document called MARKET_DATA_DESIGN.md that has code snippets and examples to implement all the market data functionality (unified API, simulator , Massive API)

  Issue creation in github
Tittle : Build complete Market Data backend 

@claude
Read all the documents in the planning directory, then build the complete Market Data backend in the backend/directory, This should include:
1. The Massive API interface
2. The unified market data interface
3. The market data simulator
4.include full unit tests

Claude Sandbox Types
There are three types of Claude sandboxes available for running Claude Code:

1. Native Sandbox
Built directly into Claude Code
Triggered via the /sandbox command
Runs on your local machine
2. Managed Claude Sandbox ("Claude Code on the Web")
Runs on Anthropic's infrastructure
Access methods:
2a. Via claude --remote
2b. Via @claude tag in GitHub (as used in this repo)
2c. Requires the Claude GitHub App installed; includes /teleport and /tasks commands
3. Third-Party Claude Sandbox
Isolated environment on the cloud
Suitable for all coding agents
Runs on third-party cloud infrastructure
Example: sprites.dev
Account: hcloudlalit@gmail.com
Credits: 600 cr
