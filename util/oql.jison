/* lexical grammar for OQL. Simplified OSDF queries. */
%lex

int  "-"?([0-9]|[1-9][0-9]+)
frac "."[0-9]+
dotted [A-Za-z_]+("."[A-Za-z0-9_]+)+

%%

\s+                              /* skip */
'"'                              return 'QUOTE'
{int}{frac}\b                    return 'FLOAT'
{int}\b                          return 'INTEGER';
"("                              return '('
")"                              return ')'
"["                              return "["
"]"                              return "]"
"&&"                             return 'AND'
"||"                             return 'OR'
"AND"                            return 'AND'
"OR"                             return 'OR'
'>='                             return 'CMP_GREATER_EQ'
'>'                              return 'CMP_GREATER'
'<='                             return 'CMP_LESS_EQ'
'<'                              return 'CMP_LESS'
"=="                             return 'EQ'
"!="                             return 'NE'
"true"                           return 'BOOL'
"false"                          return 'BOOL'
"and"                            return 'AND'
"or"                             return 'OR'
{dotted}                         return 'DOTTED'
"all"                            return 'ALL'
(\\\"|[^\[\]"])+                 return 'STRING'
[[:alnum:]_]+                    return 'ALPHANUMERIC'
[[:alpha:]][[:alnum:]_]+         return 'IDENT'
[:alpha:]+                       return 'ALPHA'
<<EOF>>                          return 'EOF'

/lex

/* operator associations and precedence */

%left '&&'
%left 'and'
%left 'AND'
%left '||'
%left  'or'
%left  'OR'
%left  '<'
%left  '>'
%left  '<='
%left  '>='
%left  '=='
%left  '!='

%start expressions

%% /* language grammar */

expressions
    : e EOF
        {return $1;}
    ;

e
    : term                      {$$ = $1;}
    | term AND term             {$$ = [$1, '&&', $3];}
    | term OR term              {$$ = [$1, '||', $3];}
    | '(' e ')' AND term        {$$ = [$2, '&&', $5];}
    | '(' e ')' OR term         {$$ = [$2, '||', $5];}
    | term AND '(' e ')'        {$$ = [$1, '&&', $4];}
    | term OR '(' e ')'         {$$ = [$1, '||', $4];}
    | '(' e ')' AND '(' e ')'   {$$ = [$2, '&&', $6];}
    | '(' e ')' OR '(' e ')'    {$$ = [$2, '||', $6];}
    | '(' e ')'                 {$$ = $2;}
    ;

term
    : search                    {$$ = $1;}
    | allsearch                 {$$ = $1;}
    | comparison                {$$ = $1;}
    | bool_check                {$$ = $1;}
    ;

search
    : query_text field          {$$ = [$1, $2];}
    ;

allsearch
    : query_text all            {$$ = [$1];}
    ;

comparison
    : field comparator number   {$$ = [$1, $2, $3];}
    ;

bool_check
    : field EQ BOOL    {$$ = [$1, $2, ($3 === 'true')];}
    | field NE BOOL    {$$ = [$1, $2, ($3 === 'true')];}
    ;

number
    : FLOAT                     {$$ = parseFloat($1, 10);}
    | INTEGER                   {$$ = parseInt($1, 10);}
    ;

all
    : '[' ALL ']'               {$$ = $2}
    ;

field
    : '[' DOTTED ']'            {$$ = $2;}
    | '[' IDENT  ']'            {$$ = $2;}
    | '[' STRING ']'            {$$ = $2;}
    | '[' FLOAT ']'             {$$ = $2;}
    | '[' INTEGER ']'           {$$ = $2;}
    ;

query_text
    : QUOTE IDENT QUOTE         {$$ = $2;}
    | QUOTE ALPHA QUOTE         {$$ = $2;}
    | QUOTE STRING QUOTE        {$$ = $2;}
    | QUOTE INTEGER QUOTE       {$$ = $2;}
    | QUOTE FLOAT QUOTE         {$$ = $2;}
    | QUOTE ALL QUOTE           {$$ = $2;}
    ;

bool_compar
    : EQ                   {$$ = $1;}
    | NE                   {$$ = $1;}
    ;

comparator
    : CMP_GREATER          {$$ = $1;}
    | CMP_LESS             {$$ = $1;}
    | CMP_GREATER_EQ       {$$ = $1;}
    | CMP_LESS_EQ          {$$ = $1;}
    | EQ                   {$$ = $1;}
    | NE                   {$$ = $1;}
    ;
