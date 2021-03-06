{
	"translatorID": "e8544423-1515-4daf-bb5d-3202bf422b58",
	"label": "beck-online",
	"creator": "Philipp Zumstein",
	"target": "^https?://beck-online\\.beck\\.de/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2014-12-08 05:31:09"
}

/*
	***** BEGIN LICENSE BLOCK *****

	beck-online Translator, Copyright © 2014 Philipp Zumstein
	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero. If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/

//Disclaimer:
//This is written mainly for articles/cases in the journals in beck-online
//Probably, it might work further on other material (e.g. ebooks) in beck-online.


var mappingClassNameToItemType = {
	'ZAUFSATZ' : 'journalArticle',
	'ZRSPR' : 'case',//Rechtssprechung
	'ZRSPRAKT' : 'case',
	'BECKRS' : 'case',
	'ZENTB' : 'journalArticle',//Entscheidungsbesprechung
	'ZBUCHB' : 'journalArticle',//Buchbesprechung
	'ZSONST' : 'journalArticle',//Sonstiges, z.B. Vorwort,
	'LSK'	: 'journalArticle', // Artikel in Leitsatzkartei
	'ZINHALTVERZ' : 'multiple'//Inhaltsverzeichnis
}

// build a regular expression for author cleanup in authorRemoveTitlesEtc()
var authorTitlesEtc = ['\\/','Dr\\.', '\\b[ji]ur\\.','\\bh\\. c\\.','Prof\\.',
		'Professor', '\\bwiss\\.', 'Mitarbeiter(?:in)?', 'RA,?', 'FAArbR',
		'Fachanwalt für Insolvenzrecht', 'Rechtsanw[aä]lt(?:e|in)?',
		'Richter am (?:AG|LG|OLG|BGH)',	'\\bzur Fussnote', 'LL\\.M\\.',
		'^Von', "\\*"];
var authorRegEx = new RegExp(authorTitlesEtc.join('|'), 'g');


function detectWeb(doc, url) {
	var dokument = doc.getElementById("dokument");
	if (!dokument) return;
	
	var type = mappingClassNameToItemType[dokument.className.toUpperCase()];
	
	if (type == 'multiple') {
		return getSearchResults(doc, true) ? type : false;
	}
	
	return type;
}

function getSearchResults(doc, checkOnly) {
	var items = {}, found = false,
		rows = ZU.xpath(doc, '//div[@class="inh"]//span[@class="inhdok"]//a | //div[@class="autotoc"]//a');
	for(var i=0; i<rows.length; i++) {
		//rows[i] contains an invisible span with some text, which we have to exclude, e.g.
		//   <span class="unsichtbar">BKR Jahr 2014 Seite </span>
		//   Dr. iur. habil. Christian Hofmann: Haftung im Zahlungsverkehr
		var title = ZU.trimInternal( ZU.xpathText(rows[i], './text()[1]') );
		var link = rows[i].href;
		if (!link || !title) continue;
		
		if (checkOnly) return true;
		found = true;
		
		items[link] = title;
	}
	
	return found ? items : false;
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc), function (items) {
			if (!items) {
				return true;
			}
			var articles = [];
			for (var i in items) {
				articles.push(i);
			}
			ZU.processDocuments(articles, scrape);
		});
	} else {
		scrape(doc, url);
	}
	
}

function authorRemoveTitlesEtc(authorStr) {
	// example 1: Dr. iur. Carsten Peter
	// example 2: Rechtsanwälte Christoph Abbott
	// example 3: Professor Dr. Klaus Messer
	return ZU.trimInternal(ZU.trimInternal(authorStr).replace(authorRegEx, ""));
}

// scrape documents that are only in the beck-online "Leitsatz-Kartei", i.e. 
// where only information about the article, not the article itself is in beck-online
function scrapeLSK(doc, url) {
	var item = new Zotero.Item(mappingClassNameToItemType['LSK']);
	
	// description example 1: "Marco Ganzhorn: Ist ein E-Book ein Buch?"
	// description example 2: "Michael Fricke/Dr. Martin Gerecke: Informantenschutz und Informantenhaftung"
	// description example 3: "Sara Sun Beale: Die Entwicklung des US-amerikanischen Rechts der strafrechtlichen Verantwortlichkeit von Unternehmen"
	var description = ZU.xpathText(doc, "//*[@id='dokument']/h1");
	var descriptionItems = description.split(':');

	//authors
	var authorsString = descriptionItems[0];
	
	var authors = authorsString.split("/");

	for (var index = 0; index < authors.length; ++index) {
		var author = authorRemoveTitlesEtc(ZU.trimInternal(authors[index]));
		item.creators.push ( ZU.cleanAuthor(author, 'author', false) );
	}
	
	//title
	item.title = ZU.trimInternal(descriptionItems[1]);
	
	// src => journalTitle, date and pages
	// example 1: "Ganzhorn, CR 2014, 492"
	// example 2: "Fricke, Gerecke, AfP 2014, 293"
	// example 3 (no date provided): "Beale, ZStrW Bd. 126, 27"
	var src = ZU.xpathText(doc, "//div[@class='lsk-fundst']/ul/li");
	var m = src.trim().match(/([^,]+?)(\b\d{4})?,\s*(\d+)$/);
	if (m) {
		item.pages = m[3];
		if (m[2]) item.date = m[2];		
		item.publicationTitle = ZU.trimInternal(m[1]);
		item.journalAbbreviation = item.publicationTitle;
		
		// if src is like example 3, then extract the volume
		var tmp = item.publicationTitle.match(/(^[A-Za-z]+)\ Bd\. (\d+)/);
		if (tmp) {
			item.publicationTitle = tmp[1];
			item.journalAbbreviation = item.publicationTitle;
			item.volume = tmp[2];
		}
	}

	item.attachments = [{
		title: "Snapshot",
		document:doc
	}];

	item.complete();
}

function addNote(originalNote, newNote) {
	if (originalNote.length == 0) {
		originalNote = "Additional Metadata: "+newNote;
	}
	else
	{
		originalNote += newNote;
	}
	return originalNote;
}

function scrapeCase(doc, url) {
	var documentClassName = doc.getElementById("dokument").className.toUpperCase();
	
	var item = new Zotero.Item('case');
	var note = "";
		
	// case name
	// in some cases, the caseName is in a separate <span>
	var caseName = ZU.xpathText(doc, '//div[@class="titel sbin4"]/h1/span');

	if (caseName) {
		item.shortTitle = caseName;
	}
	// if not, we have to extract it from the title
	else {
		caseDescription = ZU.xpathText(doc, '//div[@class="titel"]/h1 | //div[@class="titel sbin4"]/h1 | //div[@class="titel sbin4"]/h1/span');
		if (caseDescription) {
			var tmp = caseDescription.match(/[^-–]*$/);	// everything after the last slash
			if (tmp) caseName = ZU.trimInternal(tmp[0]);
			// sometimes the caseName is enclosed in („”)
			tmp = caseDescription.match(/\(\„([^”)]+)\”\)/);
			if (tmp) {
				caseName = ZU.trimInternal(tmp[1]);
			}
			if (caseDescription != caseName) {
				// save the former title (which is mostly a description of the case by the journal it is published in) in the notes
				note = addNote(note, "<h3>Beschreibung</h3><p>" + ZU.trimInternal(caseDescription) + "</p>");
			}
		}
		if (caseName) {
			item.shortTitle = caseName;
		}
	}
	
	var courtLine = ZU.xpath(doc, '//div[contains(@class, "gerzeile")]/p')[0];
	var alternativeLine = "";
	var alternativeData = [];
	if (courtLine) {
		item.court = ZU.xpathText(courtLine, './span[@class="gericht"]');
	}
	else {
		alternativeLine = ZU.xpathText(doc, '//span[@class="entscheidung"]');
		// example: OLG Köln: Beschluss vom 23.03.2012 - 6 U 67/11
		alternativeData = alternativeLine.match(/^([A-Za-zÖöÄäÜüß ]+): \b(.*?Urteil|.*?Urt\.|.*?Beschluss|.*?Beschl\.) vom (\d\d?\.\s*\d\d?\.\s*\d\d\d\d) - ([\w\s\/]*)/i);
		item.court = ZU.trimInternal(alternativeData[1]);
	}
	
	// add jurisdiction to item.extra - in accordance with citeproc-js - for compatability with Zotero-MLZ
	item.extra = "";
	if (item.court.indexOf('EuG') == 0) {
		item.extra += "{:jurisdiction: europa.eu}";
	}
	else {
		item.extra += "{:jurisdiction: de}";
	}
	
	var decisionDateStr = ZU.xpathText(doc, '//span[@class="edat"] | //span[@class="datum"]');
	if (decisionDateStr == null) {
		decisionDateStr = alternativeData[3];
	}
	//e.g. 24. 9. 2001
	item.dateDecided = decisionDateStr.replace(/(\d\d?)\.\s*(\d\d?)\.\s*(\d\d\d\d)/, "$3-$2-$1");
	
	item.docketNumber = ZU.xpathText(doc, '//span[@class="az"]');
	if (item.docketNumber == null) {
		item.docketNumber = alternativeData[4];
	}
	
	item.title = item.court+", "+decisionDateStr+" - "+item.docketNumber;
	if (item.shortTitle) {
		item.title += " - " + item.shortTitle;
	}
	
	var decisionType;
	if (courtLine) {
		item.history = ZU.xpathText(courtLine, './span[@class="vorinst"]');
	
		// type of decision. Save this in item.extra according to citeproc-js
		decisionType = ZU.xpathText(courtLine, './span[@class="etyp"]');
	}
	
	if (!decisionType) {
		decisionType = alternativeData[2];
	}
	
	if (decisionType) {
		if (/Beschluss|Beschl\./i.test(decisionType)) {
			item.extra += "\n{:genre: Beschl.}";
		}
		else if (/Urteil|(Urt\.)/i.test(decisionType)) {
			item.extra += "\n{:genre: Urt.}";
		}
	}
	
	// code to scrape the BeckRS source, if available
	// example: BeckRS 2013, 06445
	// Since BeckRS is not suitable for citing, let's push it into the notes instead
	var beckRSline = ZU.xpathText(doc, '//span[@class="fundstelle"]');
	if (beckRSline) {		
		note = addNote(note, "<h3>Fundstelle</h3><p>" + ZU.trimInternal(beckRSline) + "</p>");
		
		/* commented out, because we cannot use it for the CSL-stylesheet at the moment.
		 * If we find a better solution later, we can reactivate this code and save the
		 * information properly
		 *
		var beckRSsrc = beckRSline.match(/^([^,]+)\s(\d{4})\s*,\s*(\d+)/);
		item.reporter = beckRSsrc[1];
		item.date = beckRSsrc[2];
		item.pages = beckRSsrc[3];*/
	}

	var otherCitations = ZU.xpath(doc, '//li[contains(@id, "Parallelfundstellen")]')[0];
	if (otherCitations) {
		note = addNote(note, "<h3>Parallelfundstellen</h3><p>" + ZU.xpathText(otherCitations, './ul/li',  null, " ; ") + "</p>");
	}
	var basedOnRegulations = ZU.xpathText(doc, '//div[contains(@class,"normenk")]');
	if (basedOnRegulations) {
		note = addNote(note, "<h3>Normen</h3><p>" + ZU.trimInternal(basedOnRegulations) + "</p>");
	}
	
	item.abstractNote = ZU.xpathText(doc, '//div[@class="abstract" or @class="leitsatz"]');
	if (item.abstractNote){
		item.abstractNote = item.abstractNote.replace(/\n\s*\n/g, "\n");
	}

	// there is additional information if the case is published in a journal
	if (documentClassName == 'ZRSPR') {
		// short title of publication
		item.reporter = ZU.xpathText(doc, '//div[@id="doktoc"]/ul/li/a[2]');
		// long title of publication
		var publicationTitle = ZU.xpathText(doc, '//li[@class="breadcurmbelemenfirst"]');
		if (publicationTitle) {
			note = addNote(note, "<h3>Zeitschrift Titel</h3><p>" + ZU.trimInternal(publicationTitle) + "</p>");
		}
		
		item.date = ZU.trimInternal(ZU.xpathText(doc, '//div[@id="doktoc"]/ul/li/ul/li/a[2]'));
		
		//e.g. ArbrAktuell 2014, 150
		var shortCitation = ZU.xpathText(doc, '//div[@class="dk2"]//span[@class="citation"]');
		var pagesStart = ZU.trimInternal(shortCitation.substr(shortCitation.lastIndexOf(",")+1));
		var pagesEnd = ZU.xpathText(doc, '(//span[@class="pg"])[last()]');
		if (pagesEnd) {
			item.pages = pagesStart + "-" + pagesEnd;
		} else {
			item.pages = pagesStart
		}
		
		item.reporterVolume = item.date;
	}
	
	if (note.length != 0) {
		item.notes.push( {note: note} );
	}
	
	item.attachments = [{
		title: "Snapshot",
		document:doc
	}];

	item.complete();		
}


function scrape(doc, url) {
	var dokument = doc.getElementById("dokument");
	if (!dokument) {
		throw new Error("Could not find element with ID 'dokument'. "
		+ "Probably attempting to scrape multiples with no access.")
	}
	var documentClassName = dokument.className.toUpperCase();

	// use different scraping function for documents in LSK
	if (documentClassName == 'LSK') {
			scrapeLSK(doc, url);
			return;
	}
	if (mappingClassNameToItemType[documentClassName] == 'case') {
			scrapeCase(doc, url);
			return;
	}
	
	var item;
	if (mappingClassNameToItemType[documentClassName]) {
		item = new Zotero.Item(mappingClassNameToItemType[documentClassName]);
	}
	
	var titleNode = ZU.xpath(doc, '//div[@class="titel"]')[0] || ZU.xpath(doc, '//div[@class="dk2"]//span[@class="titel"]')[0];
	item.title = ZU.trimInternal(titleNode.textContent);
	
	// in some cases (e.g. NJW 2007, 3313) the title contains an asterisk with a footnote that is imported into the title
	// therefore, this part should be removed from the title
	var indexOfAdditionalText = item.title.indexOf("zur Fussnote");
	if (indexOfAdditionalText !=-1) {
		item.title = item.title.substr(0, indexOfAdditionalText);
	}
	
	var authorNode = ZU.xpath(doc, '//div[@class="autor"]');
	for (var i=0; i<authorNode.length; i++) {
		//normally several authors are under the same authorNode
		//and they occur in pairs with first and last names
		
		var authorFirstNames = ZU.xpath(authorNode[i], './/span[@class="vname"]');
		var authorLastNames = ZU.xpath(authorNode[i], './/span[@class="nname"]');
		for (var j=0; j<authorFirstNames.length; j++) {
			item.creators.push({
				lastName : authorLastNames[j].textContent , 
				firstName : authorFirstNames[j].textContent ,
				creatorType: "author"
			});
		}
	}
	
	if (item.creators.length == 0) {
		authorNode = ZU.xpath(doc, '//div[@class="autor"]/p | //p[@class="authorline"]/text() | //div[@class="authorline"]/p/text()');
		for (var j=0; j<authorNode.length; j++) {
			//first we delete some prefixes
			var authorString = authorRemoveTitlesEtc(authorNode[j].textContent);
			//authors can be seperated by "und" and "," if there are 3 or more authors
			//a comma can also mark the beginning of suffixes, which we want to delete
			//therefore we have to distinguish these two cases in the following
			var posUnd = authorString.indexOf("und");
			var posComma = authorString.indexOf(",");
			if (posUnd > posComma) {
				var posComma = authorString.indexOf(",",posUnd);
			}
			if (posComma > 0) {
				authorString = authorString.substr(0,posComma);
			}
			
			authorArray = authorString.split(/und|,/);
			for (var k=0; k<authorArray.length; k++) {
				var authorString = ZU.trimInternal(authorRemoveTitlesEtc(authorArray[k]));
				item.creators.push(ZU.cleanAuthor(authorString));
			}
		}
	}
	
	item.publicationTitle = ZU.xpathText(doc, '//li[@class="breadcurmbelemenfirst"]');
	item.journalAbbreviation = ZU.xpathText(doc, '//div[@id="doktoc"]/ul/li/a[2]');
	
	item.date = ZU.xpathText(doc, '//div[@id="doktoc"]/ul/li/ul/li/a[2]');
	
	//e.g. Heft 6 (Seite 141-162)
	item.issue = ZU.xpathText(doc, '//div[@id="doktoc"]/ul/li/ul/li/ul/li/a[2]').replace(/\([^\)]*\)/,"").match(/\d+/)[0];
	
	//e.g. ArbrAktuell 2014, 150
	var shortCitation = ZU.xpathText(doc, '//div[@class="dk2"]//span[@class="citation"]');
	var pagesStart = ZU.trimInternal(shortCitation.substr(shortCitation.lastIndexOf(",")+1));
	var pagesEnd = ZU.xpathText(doc, '(//span[@class="pg"])[last()]');
	if (pagesEnd) {
		item.pages = pagesStart + "-" + pagesEnd;
	} else {
		item.pages = pagesStart
	}
	
	item.abstractNote = ZU.xpathText(doc, '//div[@class="abstract"]') || ZU.xpathText(doc, '//div[@class="leitsatz"]');
	if (item.abstractNote){
		item.abstractNote = item.abstractNote.replace(/\n\s*\n/g, "\n");
	}

	if (documentClassName == "ZBUCHB") {
		item.extra = ZU.xpathText(doc, '//div[@class="biblio"]');
	}
	
	item.attachments = [{
		title: "Snapshot",
		document:doc
	}];
	
	item.complete();
}/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://beck-online.beck.de/default.aspx?vpath=bibdata%2Fzeits%2FDNOTZ-SONDERH%2F2012%2Fcont%2FDNOTZ-SONDERH.2012.88.1.htm",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Best practice – Grundstrukturen des kontinentaleuropäischen Gesellschaftsrechts",
				"creators": [
					{
						"lastName": "Roth",
						"firstName": "Günter H.",
						"creatorType": "author"
					}
				],
				"date": "2012",
				"issue": "1",
				"journalAbbreviation": "DNotZ-Sonderheft",
				"libraryCatalog": "beck-online",
				"pages": "88-95",
				"publicationTitle": "Sonderheft der Deutschen Notar-Zeitschrift",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/default.aspx?typ=reference&y=300&z=BKR&b=2001&s=99&n=1",
		"items": [
			{
				"itemType": "case",
				"title": "LG Augsburg, 24. 9. 2001 - 3 O 4995/00 - Infomatec",
				"creators": [],
				"date": "2001",
				"dateDecided": "2001-9-24",
				"abstractNote": "Leitsätze der Redaktion:\n    1. Ad-hoc-Mitteilungen richten sich nicht nur an ein bilanz- und fachkundiges Publikum, sondern an alle tatsächlichen oder potenziellen Anleger und Aktionäre.\n    2. \n    § BOERSG § 88 Abs. BOERSG § 88 Absatz 1 Nr. 1 BörsG dient neben dem Schutz der Allgemeinheit gerade auch dazu, das Vermögen des einzelnen Kapitalanlegers vor möglichen Schäden durch eine unredliche Beeinflussung der Preisbildung an Börsen und Märkten zu schützen.",
				"court": "LG Augsburg",
				"docketNumber": "3 O 4995/00",
				"extra": "{:jurisdiction: de}\n{:genre: Urt.}",
				"libraryCatalog": "beck-online",
				"pages": "99-101",
				"reporter": "BKR",
				"reporterVolume": "2001",
				"shortTitle": "Infomatec",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [
					{
						"note": "Additional Metadata: <h3>Beschreibung</h3><p>Schadensersatz wegen fehlerhafter Ad-hoc-Mitteilungen („Infomatec”)</p><h3>Parallelfundstellen</h3><p>BB 2001 Heft 42, 2130 ; DB 2001, 2334 ; NJOZ 2001, 1878 ; NJW-RR 2001, 1705 ; NZG 2002, 429 ; WPM 2001, 1944 ; ZIP 2001, 1881 ; FHZivR 47 Nr. 2816 (Ls.) ; FHZivR 47 Nr. 6449 (Ls.) ; FHZivR 48 Nr. 2514 (Ls.) ; FHZivR 48 Nr. 6053 (Ls.) ; LSK 2001, 520032 (Ls.) ; NJW-RR 2003, 216 (Ls.)</p><h3>Normen</h3><p>§ WPHG § 15 WpHG; § BOERSG § 88 BörsG; §§ BGB § 823, BGB § 826 BGB</p><h3>Zeitschrift Titel</h3><p>Zeitschrift für Bank- und Kapitalmarktrecht</p>"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/default.aspx?typ=reference&y=300&z=NJW&b=2014&s=898&n=1",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Die Entwicklung des Energierechts im Jahr 2013",
				"creators": [
					{
						"firstName": "Boris",
						"lastName": "Scholtka"
					},
					{
						"firstName": "Antje",
						"lastName": "Baumbach"
					},
					{
						"firstName": "Marike",
						"lastName": "Pietrowicz"
					}
				],
				"date": "2014",
				"abstractNote": "Der Bericht knüpft an die bisher in dieser Reihe erschienenen Beiträge zur Entwicklung des Energierechts (zuletzt NJW2013, NJW Jahr 2013 Seite 2724) an und zeigt die Schwerpunkte energierechtlicher Entwicklungen in Gesetzgebung und Rechtsanwendung im Jahr 2013 auf.",
				"issue": "13",
				"journalAbbreviation": "NJW",
				"libraryCatalog": "beck-online",
				"pages": "898-903",
				"publicationTitle": "Neue Juristische Wochenschrift",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/?vpath=bibdata%2fzeits%2fGRUR%2f2003%2fcont%2fGRUR%2e2003%2eH09%2eNAMEINHALTSVERZEICHNIS%2ehtm",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/?words=njw+2014%2C+3329&btsearch.x=42&source=default&filter=spub1%3A%22Die+Leitsatzkartei+des+deutschen+Rechts+-+2014%22%7C&btsearch.x=0&btsearch.y=0",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Zumutbarkeit von Beweiserhebungen und Wohnungsbetroffenheit im Zivilprozess",
				"creators": [
					{
						"firstName": "Christoph",
						"lastName": "Basler"
					},
					{
						"firstName": "Klaus",
						"lastName": "Meßerschmidt"
					}
				],
				"date": "2014",
				"abstractNote": "Die Durchführung von Beweisverfahren ist mit Duldungs- und Mitwirkungspflichten von Beweisgegnern und Dritten verbunden, die nur über begrenzte Weigerungsrechte verfügen. Einen Sonderfall bildet der bei „Wohnungsbetroffenheit“ eingreifende letzte Halbsatz des § ZPO § 144 ZPO § 144 Absatz I 3 ZPO. Dessen Voraussetzungen und Reichweite bedürfen der Klärung. Ferner gibt die neuere Rechtsprechung Anlass zu untersuchen, inwieweit auch der Eigentumsschutz einer Beweisaufnahme entgegenstehen kann.",
				"issue": "46",
				"journalAbbreviation": "NJW",
				"libraryCatalog": "beck-online",
				"pages": "3329-3334",
				"publicationTitle": "Neue Juristische Wochenschrift",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/Default.aspx?vpath=bibdata%2fzeits%2fGRUR%2f2014%2fcont%2fGRUR.2014.431.1.htm",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Kennzeichen- und lauterkeitsrechtlicher Schutz für Apps",
				"creators": [
					{
						"firstName": "Stephanie",
						"lastName": "Zöllner"
					},
					{
						"firstName": "Philipp",
						"lastName": "Lehmann"
					}
				],
				"date": "2014",
				"abstractNote": "Auf Grund der rasanten Entwicklung und der zunehmenden wirtschaftlichen Bedeutung von Apps kommen in diesem Zusammenhang immer neue rechtliche Probleme auf. Von den urheberrechtlichen Fragen bei der Entwicklung, über die vertragsrechtlichen Probleme beim Verkauf, bis hin zu Fragen der gewerblichen Schutzrechte haben sich Apps zu einem eigenen rechtlichen Themenfeld entwickelt. Insbesondere im Bereich des Kennzeichen- und Lauterkeitsrechts werden Rechtsprechung und Praxis vor neue Herausforderungen gestellt. Dieser Beitrag erörtert anhand von zwei Beispielsfällen die Frage nach den kennzeichen- und lauterkeitsrechtlichen Schutzmöglichkeiten von Apps, insbesondere der Übertragbarkeit bereits etablierter Grundsätze. Gleichzeitig werden die diesbezüglichen Besonderheiten herausgearbeitet.",
				"issue": "5",
				"journalAbbreviation": "GRUR",
				"libraryCatalog": "beck-online",
				"pages": "431-437",
				"publicationTitle": "Gewerblicher Rechtsschutz und Urheberrecht",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/?typ=reference&y=300&b=2014&n=1&s=2261&z=DSTR",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Der Regierungsentwurf eines Gesetzes zur Änderung der Abgaben- ordnung und des Einführungsgesetzes zur Abgabenordnung",
				"creators": [
					{
						"firstName": "Wolfgang",
						"lastName": "Joecks"
					}
				],
				"date": "2014",
				"abstractNote": "Nachdem die Selbstanzeige nach § AO § 371 AO bereits im Frühjahr 2011 nur knapp einer Abschaffung entging und (lediglich) verschärft wurde, plant der Gesetzgeber nun eine weitere Einschränkung. Dabei unterscheiden sich der Referentenentwurf vom 27.8.2014 und der Regierungsentwurf vom 26.9.2014 scheinbar kaum; Details legen aber die Vermutung nahe, dass dort noch einmal jemand „gebremst“ hat. zur Fussnote 1",
				"issue": "46",
				"journalAbbreviation": "DStR",
				"libraryCatalog": "beck-online",
				"pages": "2261-2267",
				"publicationTitle": "Deutsches Steuerrecht",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/default.aspx?vpath=bibdata%2Fzeits%2FDNOTZ-SONDERH%2F2012%2Fcont%2FDNOTZ-SONDERH.2012.88.1.htm",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Best practice – Grundstrukturen des kontinentaleuropäischen Gesellschaftsrechts",
				"creators": [
					{
						"lastName": "Roth",
						"firstName": "Günter H.",
						"creatorType": "author"
					}
				],
				"date": "2012",
				"issue": "1",
				"journalAbbreviation": "DNotZ-Sonderheft",
				"libraryCatalog": "beck-online",
				"pages": "88-95",
				"publicationTitle": "Sonderheft der Deutschen Notar-Zeitschrift",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/?words=njw+2014%2C+3329&btsearch.x=42&source=default&filter=spub1%3A%22Die+Leitsatzkartei+des+deutschen+Rechts+-+2014%22%7C&btsearch.x=0&btsearch.y=0",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Zumutbarkeit von Beweiserhebungen und Wohnungsbetroffenheit im Zivilprozess",
				"creators": [
					{
						"firstName": "Christoph",
						"lastName": "Basler"
					},
					{
						"firstName": "Klaus",
						"lastName": "Meßerschmidt"
					}
				],
				"date": "2014",
				"abstractNote": "Die Durchführung von Beweisverfahren ist mit Duldungs- und Mitwirkungspflichten von Beweisgegnern und Dritten verbunden, die nur über begrenzte Weigerungsrechte verfügen. Einen Sonderfall bildet der bei „Wohnungsbetroffenheit“ eingreifende letzte Halbsatz des § ZPO § 144 ZPO § 144 Absatz I 3 ZPO. Dessen Voraussetzungen und Reichweite bedürfen der Klärung. Ferner gibt die neuere Rechtsprechung Anlass zu untersuchen, inwieweit auch der Eigentumsschutz einer Beweisaufnahme entgegenstehen kann.",
				"issue": "46",
				"journalAbbreviation": "NJW",
				"libraryCatalog": "beck-online",
				"pages": "3329-3334",
				"publicationTitle": "Neue Juristische Wochenschrift",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/default.aspx?vpath=bibdata/ents/lsk/2014/3500/lsk.2014.35.0537.htm&pos=1",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Zum Folgenbeseitigungsanspruch bei Buchveröffentlichungen - Der Rückrufanspruch",
				"creators": [
					{
						"firstName": "Daniel",
						"lastName": "Jipp",
						"creatorType": "author"
					}
				],
				"date": "2014",
				"journalAbbreviation": "AfP",
				"libraryCatalog": "beck-online",
				"pages": "300",
				"publicationTitle": "AfP",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/default.aspx?typ=reference&y=300&z=NJW&b=2014&s=898&n=1",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Die Entwicklung des Energierechts im Jahr 2013",
				"creators": [
					{
						"firstName": "Boris",
						"lastName": "Scholtka"
					},
					{
						"firstName": "Antje",
						"lastName": "Baumbach"
					},
					{
						"firstName": "Marike",
						"lastName": "Pietrowicz"
					}
				],
				"date": "2014",
				"abstractNote": "Der Bericht knüpft an die bisher in dieser Reihe erschienenen Beiträge zur Entwicklung des Energierechts (zuletzt NJW2013, NJW Jahr 2013 Seite 2724) an und zeigt die Schwerpunkte energierechtlicher Entwicklungen in Gesetzgebung und Rechtsanwendung im Jahr 2013 auf.",
				"issue": "13",
				"journalAbbreviation": "NJW",
				"libraryCatalog": "beck-online",
				"pages": "898-903",
				"publicationTitle": "Neue Juristische Wochenschrift",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/?vpath=bibdata%2fents%2furteile%2f2012%2fcont%2fbeckrs_2012_09546.htm",
		"items": [
			{
				"itemType": "case",
				"title": "OLG Köln, 23.03.2012 - 6 U 67/11",
				"creators": [],
				"dateDecided": "2012-03-23",
				"court": "OLG Köln",
				"docketNumber": "6 U 67/11",
				"extra": "{:jurisdiction: de}\n{:genre: Urt.}",
				"libraryCatalog": "beck-online",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [
					{
						"note": "Additional Metadata: <h3>Fundstelle</h3><p>BeckRS 2012, 09546</p><h3>Parallelfundstellen</h3><p>CR 2012, 397 ; K & R 2012, 437 L ; MD 2012, 621 ; MMR 2012, 387 (m. Anm. Ho... ; NJOZ 2013, 365 ; WRP 2012, 1007 ; ZUM 2012, 697 ; LSK 2012, 250148 (Ls.)</p>"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://beck-online.beck.de/default.aspx?vpath=bibdata%2Fzeits%2Fgrur%2F2014%2Fcont%2Fgrur.2014.468.1.htm",
		"items": [
			{
				"itemType": "case",
				"title": "EuGH, 27.3.2014 - C-314/12 - UPC Telekabel/Constantin Film ua [kino.to]",
				"creators": [],
				"date": "2014",
				"dateDecided": "2014-3-27",
				"court": "EuGH",
				"docketNumber": "C-314/12",
				"extra": "{:jurisdiction: europa.eu}\n{:genre: Urt.}",
				"libraryCatalog": "beck-online",
				"pages": "468-473",
				"reporter": "GRUR",
				"reporterVolume": "2014",
				"shortTitle": "UPC Telekabel/Constantin Film ua [kino.to]",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [],
				"notes": [
					{
						"note": "Additional Metadata: <h3>Beschreibung</h3><p>EU-konforme unbestimmte Sperrverfügung gegen Internetprovider - UPC Telekabel/Constantin Film ua [kino.to]</p><h3>Parallelfundstellen</h3><p>BeckRS 2014, 80615 ; EWS 2014, 225 ; EuGRZ 2014, 301 ; EuZW 2014, 388 (m. Anm. K... ; GRUR 2014, 468 (m. Anm. M... ; GRUR Int. 2014, 469 ; K & R 2014, 329 ; MMR 2014, 397 (m. Anm. Ro... ; MittdtPatA 2014, 335 L ; NJW 2014, 1577 ; RiW 2014, 373 ; WRP 2014, 540 ; ZUM 2014, 494 ; LSK 2014, 160153 (Ls.)</p><h3>Normen</h3><p>AEUV Art. AEUV Artikel 267; Richtlinie 2001/29/EG Art. EWG_RL_2001_29 Artikel 3 EWG_RL_2001_29 Artikel 3 Absatz II, EWG_RL_2001_29 Artikel 8 EWG_RL_2001_29 Artikel 3 Absatz III</p><h3>Zeitschrift Titel</h3><p>Gewerblicher Rechtsschutz und Urheberrecht</p>"
					}
				],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/