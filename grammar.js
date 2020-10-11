// Precedence is used by the parser to determine which rule to apply when there are two rules that can be applied.
// We use the PREC dict to globally define rule pprecidence
const PREC = {
    COMMENT: 1,
    STRING: 2,
    
    COMMA: -1,
    OBJECT: -1,
    USER_TYPE: 1,
    DECLARATION: 1,
    ASSIGN: 0,
    TERNARY: 1,
    OR: 2,
    AND: 3,
    REL: 4,
    PLUS: 5,
    TIMES: 6,
    EXP: 7,
    TYPEOF: 8,
    DELETE: 8,
    VOID: 8,
    NOT: 9,
    NEG: 10,
    INC: 11,
    CALL: 12,
    NEW: 13,
    MEMBER: 14 
}

// The following is the core grammar for Solidity. It accepts Solidity smart contracts between the versions 0.4.x and 0.7.x.
module.exports = grammar({
    name: 'Solidity',

    // Extras is an array of tokens that is allowed anywhere in the document.
    extras: $ => [
        // Allow comments to be placed anywhere in the file
        $.comment,
        // Allow characters such as whitespaces to be placed anywhere in the file
        /[\s\uFEFF\u2060\u200B\u00A0]/
    ],
    
    // The word token allows tree-sitter to appropriately handle scenario's where an identifier includes a keyword.
    // Documentation: https://tree-sitter.github.io/tree-sitter/creating-parsers#keywords
    word: $ => $.identifier,

    conflicts: $ => [
        [$.primary_expression, $.type_name],
        [$._parameter_list, $.fallback_receive_definition],
        [$.primary_expression, $.type_cast_expression]
    ],

    rules: {
        //  -- [ Program ] --  
        source_file: $ => seq(
            repeat($._source_unit),
        ),

        //  -- [ Source Element ] --  
        _source_unit: $ =>  choice(
            $._directive,
            $._declaration,
        ),

        //  -- [ Directives ] --  
        _directive: $ => choice(
            $.pragma_directive,
            $.import_directive,
        ),

        // Pragma
        pragma_directive: $ => seq(
            "pragma",
            "solidity",
            repeat(field("version_constraint", $._pragma_version_constraint)),
            $._semicolon,
        ),

        _pragma_version_constraint: $ => seq(
            optional($._solidity_version_comparison_operator),
            $._solidity_version,
        ),
        _solidity_version: $ => /\d+(.\d+(.\d+)?)?/,
        _solidity_version_comparison_operator: $ => choice("<=", "<", "^", ">", ">=", "~", "="),

        // Import
        import_directive: $ => seq(
            'import',
            choice(
                $._source_import,
                seq($._import_clause, $._from_clause)
            ),
            $._semicolon,
        ),

        _source_import: $ => seq(
            field('source', $.string),
            optional(seq("as", $.identifier))
        ),

        _import_clause: $ => choice(
            $._single_import,
            $._multiple_import,
        ),

        _from_clause: $ => seq(
            "from", field('source', $.string)
        ),
    
        _single_import: $ => seq(
            "*",
            optional(
                seq(
                    "as",
                    field("import_alias", $.identifier)
                )
            )
        ),
    
        _multiple_import: $ => seq(
            '{',
            commaSep($._import_declaration),
            '}'
        ),

        _import_declaration: $  => seq(
            field("import_origin", $.identifier),
            optional(
                seq(
                    "as",
                    field("import_alias", $.identifier)
                )
            )
        ),

        //  -- [ Declarations ] --  
        _declaration: $ => choice(
            $.contract_declaration,
            $.interface_declaration,
            $.library_declaration,
            $.struct_declaration,
            $.enum_declaration,
            $.function_definition
        ),

        // Contract Declarations
        contract_declaration: $ => seq(
            optional('abstract'),
            'contract',
            field("name", $.identifier),
            optional($.class_heritage),
            field('body', $.contract_body),
        ),

        interface_declaration: $ => seq(
            'interface',
            field("name", $.identifier),
            optional($.class_heritage),
            field('body', $.contract_body),
        ),

        library_declaration: $ => seq(
            'library',
            field("name", $.identifier),
            field('body', $.contract_body),
        ),

        class_heritage: $ => seq(
            "is", commaSep1($._inheritance_specifier)
        ),

        _inheritance_specifier: $ => seq(
            field("ancestor", $._user_defined_type),
            optional(field("ancestor_arguments", $._call_arguments)),
        ),

        contract_body: $  => seq(
            "{",
            repeat(choice(
                $.function_definition,
                $.modifier_definition,
                $.state_variable_declaration,
                $.struct_declaration,
                $.enum_declaration,
                $.event_definition,
                $.using_directive,
                $.constructor_definition,
                $.fallback_receive_definition,
            )),
            "}",
        ),

        struct_declaration: $ =>  seq(
            'struct',
            $.identifier,
            '{', 
            repeat1($.struct_member),
            '}',
        ),

        struct_member: $ => seq(
            $.type_name,
            $.identifier,
            $._semicolon
        ),

        enum_declaration: $ =>  seq(
            'enum',
            field("enum_type_name", $.identifier),
            '{',
            commaSep(field("enum_value", $.identifier)),
            '}',
        ),
            

        event_definition: $ => seq(
            'event',  field('name', $.identifier), $._event_parameter_list ,  optional('anonymous'), $._semicolon
        ),

        _event_parameter_list: $ => seq(
            "(",
            commaSep(seq(
                field("type", $.type_name),
                optional("indexed"),
                optional(field("name", $.identifier)),
            )),
            ")"
        ),

        using_directive: $ => seq(
            'using', 
            field("alias", $._user_defined_type),
            'for',
            field("source", choice('*', $.type_name)),
            $._semicolon
        ),

        // -- [ Statements ] --
        _statement: $ => choice(
            $.block_statement,
            $.expression_statement,
            $.variable_declaration_statement,
            $.if_statement,
            $.for_statement,
            $.while_statement,
            $.do_while_statement,
            $.continue_statement,
            $.break_statement,
            $.try_statement,
            $.return_statement,
            $.emit_statement,
            // TODO: $.assembly_statement
        ),

        assembly_statement: $ => seq(
            'assembly',
            optional('"evmasm"'),
            "{",
            // TODO: Add yul statements
            // repeat($.yul_statement),
            "}"
        ),

        // yul_statement: $ => seq(),

        block_statement: $ => seq('{', repeat($._statement), "}"),
        variable_declaration_statement: $ => seq(
            choice(
                seq($.variable_declaration, optional(seq('=', $._expression))),
                seq($.variable_declaration_tuple, '=', $._expression),
            ),
            $._semicolon
        ),

        variable_declaration: $ => seq(
            $.type_name,
            optional(choice('memory', 'storage', 'calldata')),
            field('name', $.identifier)
        ),

        variable_declaration_tuple: $ => seq(
            '(', 
            commaSep($.variable_declaration),
            ')'
        ),

        expression_statement: $ => seq($._expression, $._semicolon),

        if_statement: $ => prec.left(seq(
            'if', '(',$._expression, ')', $._statement, optional(seq('else', $._statement)),
        )),
        
        for_statement: $ => seq(
            'for', '(', 
            choice($.variable_declaration_statement, $.expression_statement, $._semicolon),
            choice($.expression_statement, $._semicolon),
            optional($._expression),
            ')', $._statement,
        ),

        while_statement: $ => seq(
            'while', '(',$._expression, ')', $._statement,
        ),
        do_while_statement: $ => seq(
            'do', $._statement, 'while', '(',$._expression, ')',
        ),        
        continue_statement: $ => seq('continue', $._semicolon),
        break_statement: $ => seq('break', $._semicolon),
        
        try_statement: $ => seq(
            'try', $._expression, optional(seq('returns', $._parameter_list)), $.block_statement, repeat1($.catch_clause),
        ),

        catch_clause: $ => seq(
            'catch', optional(seq(optional($.identifier), $._parameter_list)), $.block_statement,
        ),

        return_statement: $ => seq(
            'return', optional($._expression), $._semicolon
        ),
        emit_statement: $ => seq(
            'emit',  $._expression, $._call_arguments, $._semicolon
        ),


        //  -- [ Definitions ] --  
        // Definitions
        state_variable_declaration: $ => seq(
            field("type", $.type_name),
            repeat(choice(
                field('visibility', $.visibility), // FIXME: this also allows external
                $.constant,
                $.override_specifier,
                $.immutable,
            )),
            field("name", $.identifier),
            optional(seq(
                '=', field("value", $._expression)
            )),
            $._semicolon
        ),
        constant: $ => "constant",
        visibility: $ => choice(
            'public',
            'internal',
            'private',
            'external',
        ),

        state_mutability: $ => choice(
            'pure',
            'view',
            'payable'
        ),

        immutable: $ => 'immutable',
        _override: $ => 'override',

        override_specifier: $ => seq(
            'override',
            optional(seq(
                '(',
                commaSep1($._user_defined_type),
                ')',
            ))
        ),

        modifier_definition: $ => seq(
            "modifier",
            field("name", $.identifier),
            optional($._parameter_list),
            repeat(choice(
                $.virtual,
                $.override_specifier,
            )),
            choice($._semicolon, field("body", $.function_body)),
        ),

        constructor_definition: $ => seq(
            'constructor',
            $._parameter_list,
            repeat(choice(
                $.modifier_invocation,
                'payable',
                choice('internal', 'public'),
            )),
            field('body', $.function_body),
        ),

        fallback_receive_definition: $ => seq(
            choice(seq(
                optional("function"),
                choice('fallback', 'receive'),
                ),
                "function"
            ),
            '(', ')',
            // FIXME: We use repeat to allow for unorderedness. However, this means that the parser 
            // accepts more than just the solidity language. The same problem exists for other definition rules.
            repeat(choice(
                $.visibility,      
                $.modifier_invocation,
                $.state_mutability,
                $.virtual,
                $.override_specifier,
            )),
            choice($._semicolon, field('body', $.function_body))
        ),

        function_definition: $ => seq(
            "function",
            field("function_name", $.identifier),
            $._parameter_list,
            repeat(choice(
                $.modifier_invocation,
                $.visibility,
                $.state_mutability,
                $.virtual,
                $.override_specifier,
            )),
            optional(seq(     
                'returns',
                $._parameter_list,
            )),
            choice($._semicolon, field('body', $.function_body))
        ),
        virtual: $ => "virtual",
        modifier_invocation: $ => seq($.identifier, optional($._call_arguments)),
        
        _call_arguments: $ => choice(
            seq(
                '(',
                commaSep(choice(
                    $._expression,
                    seq("{", commaSep($.identifier, ":", $._expression), "}"),
                )),
                ')'
            ),
        ),

        function_body: $ => seq(
            "{", 
            // TODO: make sure this is correct
                repeat($._statement),
            "}",
        ),

        // Expressions
        _expression: $ => choice(
            $.binary_expression,
            $.unary_expression,
            $.update_expression,
            $.call_expresion,
            // TODO: $.function_call_options_expression,
            $.payable_conversion_expression,
            $.meta_type_expression,
            $.primary_expression,
            $.struct_expression,
            $.ternary_expression,
            $.type_cast_expression,
        ),

        // TODO: make primary expression anonymous
        primary_expression: $ => choice(
            $.parenthesized_expression,
            $.member_expression,
            $.array_access,
            $.slice_access,
            $._primitive_type,
            $.assignment_expression,
            $.augmented_assignment_expression,
            $._user_defined_type,
            $.tuple_expression,
            $.inline_array_expression,
            $.identifier,
            $.literal,
            $.new_expression,
        ),

        // TODO: back this up with official dcumentation
        type_cast_expression: $ => prec.left(seq($._primitive_type, '(', $._expression,')')),

        ternary_expression: $ => prec.left(seq($._expression, "?", $._expression, ':', $._expression)),

        new_expression: $ => prec.left(seq('new', $.type_name)),

        tuple_expression: $ => prec(1, seq(
            '(', 
            commaSep($._expression),
            ')'
        )),

        inline_array_expression: $ => seq(
            '[', 
            commaSep($._expression),
            ']'
        ),

        binary_expression: $ => choice(
            ...[
            ['&&', PREC.AND],
            ['||', PREC.OR],
            ['>>', PREC.TIMES],
            ['>>>', PREC.TIMES],
            ['<<', PREC.TIMES],
            ['&', PREC.AND],
            ['^', PREC.OR],
            ['|', PREC.OR],
            ['+', PREC.PLUS],
            ['-', PREC.PLUS],
            ['*', PREC.TIMES],
            ['/', PREC.TIMES],
            ['%', PREC.TIMES],
            ['**', PREC.EXP],
            ['<', PREC.REL],
            ['<=', PREC.REL],
            ['==', PREC.REL],
            ['!=', PREC.REL],
            ['!==', PREC.REL],
            ['>=', PREC.REL],
            ['>', PREC.REL],
            ].map(([operator, precedence]) =>
                prec.left(precedence, seq(
                    field('left', $._expression),
                    field('operator', operator),
                    field('right', $._expression)
                ))
            )
        ),

        unary_expression: $ => choice(...[
                ['!', PREC.NOT],
                ['~', PREC.NOT],
                ['-', PREC.NEG],
                ['+', PREC.NEG],
                ['delete', PREC.DELETE],
            ].map(([operator, precedence]) =>
                prec.left(precedence, seq(
                    field('operator', operator),
                    field('argument', $._expression)
                ))
        )),

        update_expression: $ => prec.left(PREC.INC, choice(
            seq(
                field('argument', $._expression),
                field('operator', choice('++', '--'))
            ),
            seq(
                field('operator', choice('++', '--')),
                field('argument', $._expression)
            ),
        )),

        member_expression: $ => prec(PREC.MEMBER, seq(
            field('object', choice(
                $._expression,
                $.identifier,
            )),
            '.',
            field('property', alias($.identifier, $.property_identifier))
        )),

        array_access: $ => prec.right(14,seq(
            field('base', $._expression),
            '[',
            field('index', $._expression), 
            ']'
        )),

        slice_access: $ => prec(PREC.MEMBER, seq(
            field('base', $._expression),
            '[',
            field('from', $._expression), 
            ':',
            field('to', $._expression), 
            ']'
        )),

        struct_expression: $ => seq(
            $._expression,
            "{",
            commaSep(seq(
                $.identifier,
                ":",
                $._expression,
            )),
            "}"
        ),

        _lhs_expression: $ => choice(
            $.member_expression,
            $.tuple_expression,
            $.array_access,
            $.identifier,
            // $._destructuring_pattern
        ),
        parenthesized_expression: $ => prec(2, seq('(', $._expression, ')')),

        assignment_expression: $ => prec.right(PREC.ASSIGN, seq(
            field('left', choice($.parenthesized_expression, $._lhs_expression)),
            '=',
            field('right', $._expression)
        )),
      
        augmented_assignment_expression: $ => prec.right(PREC.ASSIGN, seq(
            field('left', $._lhs_expression),
            choice('+=', '-=', '*=', '/=', '%=', '^=', '&=', '|=', '>>=', '>>>=',
                '<<=',),
            field('right', $._expression)
        )),
          
        call_expresion: $ => choice(
            seq($.identifier, $._call_arguments),
        ),

        payable_conversion_expression: $ => seq('payable', $._call_arguments),
        meta_type_expression: $ => seq('type', '(', $.type_name, ')'),
        
        type_name: $ => prec(0, choice(
            $._primitive_type,
            $._user_defined_type,
            $._mapping,
            $._array_type,
            $._function_type,
        )),

        _array_type: $ => seq($.type_name, '[', optional($._expression), ']'),
        
        _function_type: $ => prec.right(seq(
            'function', $._parameter_list, optional($._return_parameters),
        )),

        _parameter_list: $ => seq(
            '(', commaSep($._parameter), ')'
        ),

        _return_parameters: $ => seq(
            '(', commaSep1($._nameless_parameter), ')'
        ),

        _nameless_parameter: $ =>  seq(
            $.type_name,
            optional($._storage_location),
        ),

        _parameter: $ =>  seq(
            field("type", $.type_name),
            optional(field("storage_location", $._storage_location)),
            optional(field("name", $.identifier)),
        ),

        _storage_location: $ => choice(
            'memory',
            'storage',
            'calldata'
        ),

        // TODO: make visible type
        _user_defined_type: $ => prec.left(PREC. USER_TYPE, seq(
            $.identifier,
            repeat(seq(
                '.',
                $.identifier,
            ))
        )),

        _mapping: $ => seq(
            'mapping', '(', $._mapping_key, '=>', $.type_name, ')',
        ),

        _mapping_key: $ => choice(
            $._primitive_type,
            $._user_defined_type
        ),

        _primitive_type: $ => prec.left(choice(
            seq('address', optional('payable')),
            'bool',
            'string',
            'var',
            $._int,
            $._uint,
            $._bytes,
            $._fixed,
            $._ufixed,
        )),

        _int: $ => choice (
            'int', 'int8', 'int16', 'int24', 'int32', 'int40', 'int48', 'int56', 'int64', 'int72', 'int80', 'int88', 'int96', 'int104', 'int112', 'int120', 'int128', 'int136', 'int144', 'int152', 'int160', 'int168', 'int176', 'int184', 'int192', 'int200', 'int208', 'int216', 'int224', 'int232', 'int240', 'int248', 'int256'
        ),
        _uint: $ => choice (
            'uint', 'uint8', 'uint16', 'uint24', 'uint32', 'uint40', 'uint48', 'uint56', 'uint64', 'uint72', 'uint80', 'uint88', 'uint96', 'uint104', 'uint112', 'uint120', 'uint128', 'uint136', 'uint144', 'uint152', 'uint160', 'uint168', 'uint176', 'uint184', 'uint192', 'uint200', 'uint208', 'uint216', 'uint224', 'uint232', 'uint240', 'uint248', 'uint256' 
        ),
        _bytes: $ => choice (
            'byte', 'bytes', 'bytes1', 'bytes2', 'bytes3', 'bytes4', 'bytes5', 'bytes6', 'bytes7', 'bytes8', 'bytes9', 'bytes10', 'bytes11', 'bytes12', 'bytes13', 'bytes14', 'bytes15', 'bytes16', 'bytes17', 'bytes18', 'bytes19', 'bytes20', 'bytes21', 'bytes22', 'bytes23', 'bytes24', 'bytes25', 'bytes26', 'bytes27', 'bytes28', 'bytes29', 'bytes30', 'bytes31', 'bytes32'
        ),

        _fixed: $ => choice (
            'fixed',
            /fixed([0-9]+)x([0-9]+)/
        ),
        _ufixed: $ => choice (
            'ufixed',
            /ufixed([0-9]+)x([0-9]+)/
        ),

        _semicolon: $ => ';',

        identifier: $ => /[a-zA-Z$_][a-zA-Z0-9$_]*/,

        number: $ => /\d+/,
        literal: $ => choice(
            $.string_literal,
            $.number_literal,
            $.boolean_literal,
            $.hex_string_literal,
            $.unicode_string_literal,
        ),

        string_literal: $ => prec.left(repeat1($.string)),
        number_literal: $ => seq(choice($.decimal_number, $.hex_number), optional($.number_unit)),
        decimal_number: $ =>  seq(/\d+(.\d+)?/, optional(/[eE](-)?d+/)),
        hex_number: $ => seq('0x', optional(optionalDashSeparation($._hex_digit))),
        _hex_digit: $ => /([a-fA-F0-9][a-fA-F0-9])/, 
        number_unit: $ => choice(
            'wei','szabo', 'finney', 'gwei', 'ether', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'years'
        ),
        boolean_literal: $ => choice('true', 'false'),
        hex_string_literal: $ => prec.left(repeat1(seq(
            'hex',
            choice(
                seq('"', optional(optionalDashSeparation($._hex_digit)), '"'),
                seq("'", optional(optionalDashSeparation($._hex_digit)), "'"),
            )))),
        _escape_sequence: $ => seq('\\', choice(
            // TODO: it might be allowed to escape non special characters
            /"'\\bfnrtv\n\r/,
            /u([a-fA-F0-9]{4})/,
            /x([a-fA-F0-9]{2})/,
        )),
        _single_quoted_unicode_char: $ => choice(/[^'\r\n\\]/, $._escape_sequence),
        _double_quoted_unicode_char: $ => choice(/[^"\r\n\\]/, $._escape_sequence),
        unicode_string_literal: $ => prec.left(repeat1(seq(
            'unicode',
            choice(
                seq('"', repeat($._double_quoted_unicode_char), '"'),
                seq("'", repeat($._single_quoted_unicode_char), "'"),
        )))),

        string: $ => choice(
            seq(
            '"',
            repeat(choice(
                token.immediate(prec(PREC.STRING, /[^"\\\n]+|\\\r?\n/)),
                $.escape_sequence
            )),
            '"'
            ),
            seq(
            "'",
            repeat(choice(
                token.immediate(prec(PREC.STRING, /[^'\\\n]+|\\\r?\n/)),
                $.escape_sequence
            )),
            "'"
            )
        ),
        escape_sequence: $ => token.immediate(seq(
            '\\',
            choice(
              /[^xu0-7]/,
              /[0-7]{1,3}/,
              /x[0-9a-fA-F]{2}/,
              /u[0-9a-fA-F]{4}/,
              /u{[0-9a-fA-F]+}/
            )
        )),

        comment: $ => token(
            prec(PREC.COMMENT, 
                choice(
                    seq('//', /.*/),
                    seq(
                        '/*',
                        /.*/,
                        '*/'
                    )       
                )
            )
        ),
    }
  }
);

function commaSep1(rule) {
    return seq(
        rule,
        repeat(
            seq(
                ',',
                rule
            )
        ),
        optional(','),
    );  
}
  
function commaSep(rule) {
    return optional(commaSep1(rule));
}

function optionalDashSeparation(rule) {
    return seq(
        rule,
        repeat(
            seq(
                optional('_'),
                rule
            )
        ),
    );  
}
  