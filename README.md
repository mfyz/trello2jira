# trello2jira
Trello to Jira migration script written in nodejs

## Installation

1) npm install
2) Copy cred-*-sample.js to have same filenames without -sample. Add your credentials for jira and trello
3) Check out the last few blocks in the index.js for proper method you want to explore yor trello/jira meta data.
4) node index.js

## Migration of a board

- Explore your broads and note board ids you want to migrate
- Explore the lists in the board you want to migrate and note list ids
- Explore your jira issue meta with project ids and issue type ids
- Put all 3 data points in the large block at the end of index.js
- Use last bool parameter to test issue generation on jira side, then if all looks good, disable that parameter and re-run the script.
