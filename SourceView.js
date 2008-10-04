/*
 * Copyright (C) 2007, 2008 Apple Inc.  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

WebInspector.SourceView = function(resource)
{
    // Set the sourceFrame first since WebInspector.ResourceView will set headersVisible
    // and our override of headersVisible needs the sourceFrame.
    this.sourceFrame = new WebInspector.SourceFrame(null, this._addBreakpoint.bind(this));

    WebInspector.ResourceView.call(this, resource);

    resource.addEventListener("finished", this._resourceLoadingFinished, this);

    this.element.addStyleClass("source");

    this._frameNeedsSetup = true;

    this.contentElement.appendChild(this.sourceFrame.element);

    var gutterElement = document.createElement("div");
    gutterElement.className = "webkit-line-gutter-backdrop";
    this.element.appendChild(gutterElement);
}

WebInspector.SourceView.prototype = {
    set headersVisible(x)
    {
        if (x === this._headersVisible)
            return;

        var superSetter = WebInspector.ResourceView.prototype.__lookupSetter__("headersVisible");
        if (superSetter)
            superSetter.call(this, x);

        this.sourceFrame.autoSizesToFitContentHeight = x;
    },

    show: function(parentElement)
    {
        WebInspector.ResourceView.prototype.show.call(this, parentElement);
        this.setupSourceFrameIfNeeded();
    },

    hide: function()
    {
        WebInspector.View.prototype.hide.call(this);
        this._currentSearchResultIndex = -1;
    },

    resize: function()
    {
        if (this.sourceFrame.autoSizesToFitContentHeight)
            this.sourceFrame.sizeToFitContentHeight();
    },

    detach: function()
    {
        // FIXME: We need to mark the frame for setup on detach because the frame DOM is cleared
        // when it is removed from the document. Is this a bug?
        WebInspector.ResourceView.prototype.detach.call(this);
        this._frameNeedsSetup = true;
        this._sourceFrameSetup = false;
    },

    setupSourceFrameIfNeeded: function()
    {
        if (this.resource.finished && !this.resource.failed && this._frameNeedsSetup) {
            delete this._frameNeedsSetup;

            this.attach();

            InspectorController.addResourceSourceToFrame(this.resource.identifier, this.sourceFrame.element);

            if (this.resource.type === WebInspector.Resource.Type.Script) {
                this.sourceFrame.addEventListener("syntax highlighting complete", this._syntaxHighlightingComplete, this);
                this.sourceFrame.syntaxHighlightJavascript();
            } else
                this._sourceFrameSetupFinished();
        }
    },

    _resourceLoadingFinished: function(event)
    {
        if (this.visible)
            this.setupSourceFrameIfNeeded();
        this.resource.removeEventListener("finished", this._resourceLoadingFinished, this);
    },

    _addBreakpoint: function(line)
    {
        var sourceID = null;
        var closestStartingLine = 0;
        var scripts = this.resource.scripts;
        for (var i = 0; i < scripts.length; ++i) {
            var script = scripts[i];
            if (script.startingLine <= line && script.startingLine >= closestStartingLine) {
                closestStartingLine = script.startingLine;
                sourceID = script.sourceID;
            }
        }

        var breakpoint = new WebInspector.Breakpoint(this.resource.url, line, sourceID);
        WebInspector.panels.scripts.addBreakpoint(breakpoint);
    },

    // The rest of the methods in this prototype need to be generic enough to work with a ScriptView.
    // The ScriptView prototype pulls these methods into it's prototype to avoid duplicate code.

    searchCanceled: function()
    {
        this._currentSearchResultIndex = -1;
        this._searchResults = [];
        delete this._delayedFindSearchMatches;
    },

    performSearch: function(query, finishedCallback)
    {
        // Call searchCanceled since it will reset everything we need before doing a new search.
        this.searchCanceled();

        this._searchFinishedCallback = finishedCallback;

        function findSearchMatches(query, finishedCallback)
        {
            this._searchResults = InspectorController.search(this.sourceFrame.element.contentDocument, query);
            if (this._searchResults)
                finishedCallback(this, this._searchResults.length);
        }

        if (!this._sourceFrameSetup) {
            // The search is performed in _sourceFrameSetupFinished by calling _delayedFindSearchMatches.
            this._delayedFindSearchMatches = findSearchMatches.bind(this, query, finishedCallback);
            this.setupSourceFrameIfNeeded();
            return;
        }

        findSearchMatches.call(this, query, finishedCallback);
    },

    jumpToFirstSearchResult: function()
    {
        if (!this._searchResults || !this._searchResults.length)
            return;
        this._currentSearchResultIndex = 0;
        this._jumpToSearchResult(this._currentSearchResultIndex);
    },

    jumpToLastSearchResult: function()
    {
        if (!this._searchResults || !this._searchResults.length)
            return;
        this._currentSearchResultIndex = (this._searchResults.length - 1);
        this._jumpToSearchResult(this._currentSearchResultIndex);
    },

    jumpToNextSearchResult: function()
    {
        if (!this._searchResults || !this._searchResults.length)
            return;
        if (++this._currentSearchResultIndex >= this._searchResults.length)
            this._currentSearchResultIndex = 0;
        this._jumpToSearchResult(this._currentSearchResultIndex);
    },

    jumpToPreviousSearchResult: function()
    {
        if (!this._searchResults || !this._searchResults.length)
            return;
        if (--this._currentSearchResultIndex < 0)
            this._currentSearchResultIndex = (this._searchResults.length - 1);
        this._jumpToSearchResult(this._currentSearchResultIndex);
    },

    showingFirstSearchResult: function()
    {
        return (this._currentSearchResultIndex === 0);
    },

    showingLastSearchResult: function()
    {
        return (this._searchResults && this._currentSearchResultIndex === (this._searchResults.length - 1));
    },

    revealLine: function(lineNumber)
    {
        this.setupSourceFrameIfNeeded();
        this.sourceFrame.revealLine(lineNumber);
    },

    highlightLine: function(lineNumber)
    {
        this.setupSourceFrameIfNeeded();
        this.sourceFrame.highlightLine(lineNumber);
    },

    addMessage: function(msg)
    {
        this.sourceFrame.addMessage(msg);
    },

    clearMessages: function()
    {
        this.sourceFrame.clearMessages();
    },

    _jumpToSearchResult: function(index)
    {
        var foundRange = this._searchResults[index];
        if (!foundRange)
            return;

        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(foundRange);

        if (foundRange.startContainer.scrollIntoViewIfNeeded)
            foundRange.startContainer.scrollIntoViewIfNeeded(true);
        else if (foundRange.startContainer.parentNode)
            foundRange.startContainer.parentNode.scrollIntoViewIfNeeded(true);
    },

    _sourceFrameSetupFinished: function()
    {
        this._sourceFrameSetup = true;
        if (this._delayedFindSearchMatches) {
            this._delayedFindSearchMatches();
            delete this._delayedFindSearchMatches;
        }
    },

    _syntaxHighlightingComplete: function(event)
    {
        this._sourceFrameSetupFinished();
        this.sourceFrame.removeEventListener("syntax highlighting complete", null, this);
    }
}

WebInspector.SourceView.prototype.__proto__ = WebInspector.ResourceView.prototype;
