devise.define(['require', 'jquery', 'dvsPageData'], function (require, $, dvsPageData) {

    var nodes = null;
    var nodeHeight = 82;
    var nodeThreshold = 5;
    var nodesCalculated = false;
    var floaterNodePresent = false;

    var initializeNodeView = function () {

        nodes = [];

        loadNodeLocations();
        solveNodeCollisions();
        placeNodes();
        openNodeMode();

        return true;
    };

    function loadNodeLocations() {
        // Collections
        $.each(dvsPageData.collections, function(collectionName, collection) {
            $.each(collection, function(index, binding) {
                // build to binding with flag to turn on collection true
                buildBinding(binding, index, collectionName);
            });
        });

        // Regular groups and other nodes
        $.each(dvsPageData.bindings, function (index, binding) {
            buildBinding(binding, index);
        });
    }

    function getCoordinates(binding, index, collectionName) {
        var collection = collectionName ? collectionName + '-' : '';
        var selector = '[data-dvs-' + collection + binding.key + '-id="' + binding.key + '"]';
        var coords = $(selector).first().offset();

        // attempt to find the hidden placeholder for
        // this binding/collection since we do not see
        // it on the page. This could be a devise-tag
        // inside of @if or @foreach blocks
        if (typeof coords === 'undefined') {
            selector = '[data-dvs-placeholder-' + collection + binding.key + '-id="' + binding.key + '"]';
            $(selector).first().show();
            coords = $(selector).first().offset();
            $(selector).first().hide();
        }

        return coords;
    }

    function buildBinding(binding, index, collectionName) {
        var props = {};

        props.coordinates = null;

        if (typeof collectionName == 'undefined') {
            collectionName = '';
        }

        // Start the coordinates where the item is located
        props.element = binding;
        props.element.index = index;
        props.element.alternateTarget = binding.alternateTarget;
        props.coordinates = getCoordinates(binding, index, collectionName);
        props.categoryName = binding.category;
        props.group = binding.group;
        props.collection = collectionName;

        var inCategory = isInCategory(props);
        var inGroup = isInGroup(props);
        var groupNode = getGroupNode(props);
        var categoryNode = getIndexOfCategoryNode(inCategory, props);

        addToNodesArray(inGroup, categoryNode, groupNode, props);
    }

    function isInCategory(props) {
        return props.categoryName != null;
    }

    function isInGroup(props) {
        return props.group != null;
    }

    function getIndexOfCategoryNode(inCategory, props) {
        var _categoryNode = false;

        if (inCategory) {
            _categoryNode = getCategoryNode(props);

            if (_categoryNode === false) {
                // Node for this category hasn't been made yet - let's make it!
                _categoryNode = makeCategoryNode(props);
            }
        }
        return _categoryNode;
    }

    function getCategoryNode(props) {
        var _categoryExists = false;

        $.each(nodes, function (index, node) {
            if (node.categoryName == props.categoryName) {
                _categoryExists = index;
            }
        });

        return _categoryExists;
    }

    function addToNodesArray(inGroup, categoryNode, groupNode, props) {

        if (inGroup) {

            if (categoryNode !== false && groupNode !== false) {
                // Category Node and group index exists
                addToGroup(groupNode, props);
            } else if (categoryNode !== false && groupNode === false) {
                // Category Node exists but not the group index
                makeGroupInCategory(categoryNode, props);
                addToCategoryCount(categoryNode);
            } else if (groupNode !== false){
                // Group index exists
                addToGroup(groupNode, props);
            } else {
                // Node for this group doesn't exist
                makeGroupNode(props);
            }
        } else {
            // Add to elements
            makeSimpleElementNode(props);
        }

    }

    function getGroupNode(props) {
        var _groupExists = false;

        $.each(nodes, function (index, node) {

            if (typeof node.groups != 'undefined') {

                $.each(node.groups, function (groupName) {

                    if (groupName == props.group) {
                        _groupExists = index;
                    }
                });
            }
        });

        return _groupExists;
    }

    function makeCategoryNode(props) {
        return nodes.push({
            coordinates: props.coordinates,
            collection: props.collection,
            categoryName: props.categoryName,
            categoryCount: 0
        }) - 1;
    }

    function makeGroupInCategory(index, props) {
        if (typeof nodes[index].groups == 'undefined') {
            nodes[index].groups = {};
        }

        nodes[index].groups[props.group] = [];
        nodes[index].groups[props.group].push(props.element);
    }

    function addToCategoryCount(index) {
        nodes[index].categoryCount++;
    }

    function addToGroup(groupNode, props) {
        nodes[groupNode].groups[props.group].push(props.element);
    }

    function makeGroupNode(props) {
        var _index = nodes.push({
                coordinates: props.coordinates,
                collection: props.collection,
                groups: {}
        }) - 1;

        nodes[_index].groups[props.group] = [];
        nodes[_index].groups[props.group].push(props.element);
    }

    function makeSimpleElementNode(props) {
        var _index = nodes.push({
                coordinates: props.coordinates,
                collection: props.collection,
                elements: []
        }) - 1;

        nodes[_index].elements.push(props.element);
    }

    /**
     * Uses calculated coordinates to dynamically place edit nodes
     *
     * @return Void
     */
    function placeNodes() {
        $.each(nodes, function (index, node) {

            if (typeof node.coordinates !== 'undefined') {
                placeNode(node);
            } else {
                placeNodeInFloaters(node);
            }
        });
    }

    function calculateSide(coordinates) {
        var half = $(window).width() / 2;
        var side = 'left';

        if (typeof coordinates == 'undefined') {
            side = 'float';
        } else if (coordinates.left > half) {
            side = 'right';
        }

        return side;
    }

    function placeNode(node) {

        var side = calculateSide(node.coordinates);
        var newNode = $('<div>')
            .addClass('dvs-node ' + side)
            .css({
                top: node.coordinates.top
            });
        var label = getLabel(node);

        var newNodeInnerWrapper = $('<div>').addClass('dvs-node-inner-wrapper');
        var label = $('<span>').html(label);
        var svgPath = require.toUrl('/packages/devisephp/cms/img/node-arrow.svg');
        var svg = $(newNodeInnerWrapper).load(svgPath);

        newNode.append(newNodeInnerWrapper);
        newNode.append(label);
        newNode.data('dvsData', node);

        $('#dvs-nodes').append(newNode);
    }

    function getLabel(node) {
        if (typeof node.categoryName != 'undefined') {
            return node.categoryName + ' <span class="count">' + node.categoryCount + '</span>';
        } else if (typeof node.groups != 'undefined') {
            // There can only be one group so let's grab the first index key
            return Object.keys(node.groups)[0];
        } else {
            // There can only be one element so let's grab the first one's human name
            return node.elements[0].humanName;
        }
    }

    function placeNodeInFloaters(node) {
        if (!floaterNodePresent) {
            drawFloaterNode();
        }

        node.label = getLabel(node);

        var _currentNodes = $('#dvs-floater-node').data('nodes');
        _currentNodes = typeof _currentNodes == 'undefined' ? [] : _currentNodes;
        _currentNodes.push(node);

        $('#dvs-floater-node').data('nodes', _currentNodes);
    }

    function drawFloaterNode() {
        var floaterNode = $('<div>')
            .attr('id', 'dvs-floater-node')
            .html('Hidden Nodes');

        $('#dvs-nodes').append(floaterNode);
    }

    /**
     * Finds where collisions are occurring and shifts them
     *
     * @return Void
     */
    function solveNodeCollisions() {

        // Flip it so we work from the bottom of the DOM up
        nodes.reverse();

        // Loop through each node and discover any collisions
        $.each(nodes, function (index, node) {

            var nodeSide = calculateSide(node.coordinates);

            if (nodeSide !== 'float' && solveCollision(node, nodeSide, index) > 0) {
                nodes.reverse();
                solveNodeCollisions();
            }

        });

        // Flip it back!
        nodes.reverse();
    }

    function solveCollision(node, nodeSide, index) {
        var collisions = 0;

        $.each(nodes, function (i, comparisonNode) {
            // Ignore comparison with itself
            if (i != index) {

                // Calculate if they are on the same side
                var comparisonSide = calculateSide(comparisonNode.coordinates);
                var comparisonNodeY2 = comparisonSide == 'float' ? 'float' : comparisonNode.coordinates.top + nodeHeight;

                // If they are on the same side and collide vertically we have a collision
                while (
                        // Are they on the same side?
                        (comparisonSide == nodeSide) &&
                        // Is the current node's top coordinate between the comparison node's top and bottom?
                        (node.coordinates.top >= comparisonNode.coordinates.top &&
                        node.coordinates.top <= comparisonNodeY2)
                    ) {
                    // We have a collision so push it down a little
                    nodes[index].coordinates.top += nodeThreshold;
                    collisions++;
                }
            }
        });

        return collisions;
    }

    function openNodeMode() {
        $('#dvs-mode')
            .removeClass('dvs-admin-mode dvs-sidebar-mode')
            .addClass('dvs-node-mode');
        $('#dvs-node-mode-button').html('Exit Editor');
    }

    return initializeNodeView;

});
