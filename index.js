
const pMap = require("p-map");
const Trello = require("node-trello");
const JiraClient = require('jira-connector');
const { key, token } = require("./cred-trello");
const { host, username, password } = require("./cred-jira");

const t = new Trello(key, token);
const jira = new JiraClient( { host, basic_auth: { username, password }});


function jiraExploreMetadata(boardId){
	return new Promise(function(resolve, reject){
		// /api/2/issue/createmeta?projectKeys=QA&issuetypeNames=Bug&expand=projects.issuetypes.fields
		jira.issue.getCreateMetadata({}, function(error, data) {
			// console.log(error);
			// console.log(data);
			for (i in data.projects) {
				// console.log(data.projects[i]);
				console.log(
					"\n",
					data.projects[i].id,
					"\t",
					data.projects[i].key,
					"\t",
					data.projects[i].name,
				);
				for (j in data.projects[i].issuetypes) {
					console.log(
						"\t",
						data.projects[i].issuetypes[j].id,
						"\t",
						data.projects[i].issuetypes[j].name,
					);
				}
			}
			resolve();
		});
	});
}

function jiraCreateIssue(params){
	return new Promise(function(resolve, reject){
		jira.issue.createIssue({
			"fields": {
				"project": {
					"id": params.projectId
				},
				"issuetype": {
					"id": params.issueType
				},
				"summary": params.title,
				"description": params.desc,
				"reporter": {
					"name": "admin"
				},
			}
		}, function(error, issue) {
			if (error) console.log(error);
			// console.log(issue);
			// console.log(issue.fields.summary);
			resolve(issue);
		});
	});
}

function jiraGetIssue(issueKey){
	return new Promise(function(resolve, reject){
		jira.issue.getIssue({
			issueKey: issueKey
		}, function(error, issue) {
			console.log(error);
			console.log(issue);
			// console.log(issue.fields.summary);
		});
	});
}

function trelloGetProfile(params){
	return new Promise(function(resolve, reject){
		t.get("/1/members/me", function(err, data) {
			if (err) throw err;
			console.log(data);
		});
	});
}

function trelloGetBoards(boardName){
	return new Promise(function(resolve, reject){
		t.get("/1/members/me/boards", function(err, data) {
			if (err) throw err;
			
			for (i in data) {
				console.log(
					data[i].id,
					"\t",
					data[i].name,
				);
			}
		});
	});
}

function trelloGetBoardLists(boardId){
	return new Promise(function(resolve, reject){
		// let boardId = "5a1b5b63e91eabe3455d36bc";
		t.get("/1/boards/" + boardId + "/lists", function(err, data) {
			if (err) throw err;
			// console.log(data);
			var lists = [];
			for (i in data) {
				// console.log(
				// 	data[i].id,
				// 	"\t",
				// 	data[i].name,
				// );
				lists.push([
					data[i].id,
					data[i].name,
				]);
			}
			resolve(lists);
		});
	});
}

function trelloGetListCards(listId){
	return new Promise(function(resolve, reject){
		// let listId = "5c4144e1083a4b618514b2ce";
		t.get("/1/lists/" + listId + "/cards", function(err, data) {
			if (err) throw err;
			// console.log(data);
			resolve(data);
		});
	});
}

function trelloGetCardChecklistAsText(cardId) {
	return new Promise((resolve, reject) => {
		t.get("/1/cards/" + cardId + '/checklists', function(err, data) {
			if (err) throw err;
			// console.log(data);
			
			let checklistText = "";

			for (i in data) {
				checklistText += "\n* " + data[i].name;

				for (j in data[i].checkItems) {
					checklistText += "\n** " + data[i].checkItems[j].name + 
						(data[i].checkItems[j].state == 'incomplete' ? "" : " [DONE]");
				}
			}

			resolve(checklistText);
		});
	});
}

async function trelloGetCardAttachmentsAsText(cardId) {
	return new Promise((resolve, reject) => {
		t.get("/1/cards/" + cardId + '/attachments', function(err, data) {
			if (err) throw err;
			// console.log(data);
			
			let attachmentsText = "";

			for (i in data) {
				attachmentsText += "\n- [" + data[i].name + "|" + data[i].url + "]";
			}

			resolve(attachmentsText);
		});
	});
}

async function trelloGetCardCommentsAsText(cardId) {
	return new Promise((resolve, reject) => {
		t.get("/1/cards/" + cardId + '/actions', function(err, data) {
			if (err) throw err;
			// console.log(data);

			let commentsText = "";

			for (i in data) {
				if (data[i].type == 'commentCard') {
					commentsText += "\n\n[" + data[i].date + 
						"] @" + data[i].memberCreator.username + 
						" {quote} " + data[i].data.text + " {quote}"
				}
			}
			resolve(commentsText);
		});
	});
}

async function trelloGetCardDetailsFromCardObjectAsDescription(card, list) {
	let desc = card.desc;

	if (card.name.length > 255) {
		desc = "*Long Title:* " + card.name + "\n\n" + desc;
	}

	if (card.badges.checkItems > 0) {
		desc += "\n\n*Checklists:* ";
		desc += await trelloGetCardChecklistAsText(card.id);
	}
	
	if (card.badges.attachments > 0) {
		desc += "\n\n*Attachments:* ";
		desc += await trelloGetCardAttachmentsAsText(card.id);
	}

	desc += "\n\n-------------------\n\n[Trello Card Link|" + card.shortUrl + "]";
	desc += "  -  *List*: " + list[1];

	if (card.labels.length > 0) {
		desc += "  -  *Labels:* " + card.labels[0].name;
	}
	
	if (card.badges.comments > 0) {
		desc += "\n\n-------------------\nh2. Comments ";
		desc += await trelloGetCardCommentsAsText(card.id);
	}

	return desc;
}

function trelloToJiraMigrationByList(trelloBoardId, jiraProjectId, jiraProjectIssueTypeId, toBeMigratedBoardIdsString, testWithOneCard) {
	// const trelloBoardId = "58d009a9671f3c23778153d5";
	// const jiraProjectId = "10013";
	// const jiraProjectIssueTypeId = "10056";
	const toBeMigratedBoardIds = toBeMigratedBoardIdsString.split(" ");

	let boardLists = [];

	trelloGetBoardLists(trelloBoardId)
	.then((lists) => {
		// console.log(lists); return;
		const listToProcess = [];
		for (i in lists) {
			if (toBeMigratedBoardIds.indexOf(lists[i][0]) !== -1) {
				listToProcess.push(lists[i]);
			}
		}
		boardLists = listToProcess;
		// console.log(listToProcess); return;
		return pMap(listToProcess, async (listItem) => {
			return await trelloGetListCards(listItem[0]);
		}, { concurrency: 1 });
	})
	.then((listCards) => {
		return new Promise(async (resolve, reject) => {
			let cardsToMigrate = [];
			let cardDesc = "";

			for (lci in listCards) {
				// console.log(boardLists[lci][1]);
				// console.log(listCards[lci].length);

				for (lcj in listCards[lci]) {
					if (typeof listCards[lci][lcj]['name'] !== 'undefined') {
						cardDesc = await trelloGetCardDetailsFromCardObjectAsDescription(listCards[lci][lcj], boardLists[lci]);
						
						cardsToMigrate.push({
							title: listCards[lci][lcj]['name'],
							desc: cardDesc
						});
					}
				}
			}

			resolve(cardsToMigrate);
		});
	})
	.then(async (cards) => {
		let cardsToMigrate = cards;
		if (testWithOneCard) cardsToMigrate = cards.slice(0, 1);
		// console.log(cardsToMigrate);

		for (i in cardsToMigrate) {
			const res = await jiraCreateIssue({
				projectId: jiraProjectId,
				issueType: jiraProjectIssueTypeId,
				title: cardsToMigrate[i].title.slice(0, 255),
				desc: cardsToMigrate[i].desc
			});

			console.log(
				(typeof res['key'] === undefined ? 'ERR' : res['key']) + "   " +
				cardsToMigrate[i].title.slice(0, 70)
			);
		}
	});
}


// jiraExploreMetadata();
// trelloGetBoards();
// trelloGetBoardLists("asdasdasdasdad").then((lists) => { lists.map((list) => { console.log(list[0] + "\t\t" + list[1]); }) });

if (
	// false && // comment this line to enable/disable
	true
) {
	trelloToJiraMigrationByList(

					/* trelloBoardId */  "asdasdasdasdad",
					/* jiraProjectId */  "23213123",
			/* jiraProjectIssueTypeId */ "5675675",
		/* toBeMigratedBoardIdsString */ "w87r6we87rw6er rt0y9rty0r9t xc46c5zxc45",

		// /* test with single card only */ true

	);
}
