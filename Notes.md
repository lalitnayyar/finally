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

Please read all the documentation in the planning folder. The market data backend has been implemented with tests. Please carry out a comprehensive code review , run all tests, and write your conclusion to the file MARKET_DATA_REVEW.md

Ok i have merged - please switch to main and do a pull, then please carry out all the fixes and improvements that you have documented in the review file. keep working until all tests pass and the market data backend is ready . Then push your new branch to github 


Create an Agent Team to complete the project as defined. Team-members: a Front-end engineer to work on the frontend, a  Backend API Engineer on the backend, a Database engineer on all DB related code, an LLM Engineer on the LLM Calls. While all team -members should work on until tests, there should be an Integration tester team-memeber, that builds and run end-to-end Playwright tests when ready, reporiting issues back to be fixed  by the team-members. Finally , a Devops engineer for the Docker container and the scripts.