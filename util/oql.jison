/* lexical grammar for OQL. Simplified OSDF queries. */
%lex

int  "-"?([0-9]|[1-9][0-9]+)
frac "."[0-9]+
dotted [A-Za-z_]+("."[A-Za-z0-9_]+)+
and [Aa][Nn][Dd]
or  [Oo][Rr]
true [Tt][Rr][Uu][Ee]
false [Ff][Aa][Ll][Ss][Ee]
not [Nn][Oo][Tt]

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
{and}                            return 'AND'
"||"                             return 'OR'
{or}                             return 'OR'
'>='                             return 'CMP_GTE'
'>'                              return 'CMP_GT'
'<='                             return 'CMP_LTE'
'<'                              return 'CMP_LT'
"=="                             return 'EQ'
"!="                             return 'NE'
{true}                           return 'BOOL'
{false}                          return 'BOOL'
{not}                            return 'NOT'
"!"                              return 'NOT'

{dotted}                         return 'DOTTED'
"all"                            return 'ALL'
(\\\"|[^\[\]"])+                 return 'STRING'
[[:alnum:]_]+                    return 'ALPHANUMERIC'
[[:alpha:]][[:alnum:]_]+         return 'IDENT'
[:alpha:]+                       return 'ALPHA'
<<EOF>>                          return 'EOF'

/lex

/* operator associations and precedence */
%left '||' 'or' 'OR'
%left '&&' 'and' 'AND'
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
    | e (AND e)?                {$$ = [$1, '&&', $3];}
    | e (OR e)?                 {$$ = [$1, '||', $3];}
    | '(' e ')'                 {$$ = $2;}
    ;

term
    : search                    {$$ = $1;}
    | allsearch                 {$$ = $1;}
    | comparison                {$$ = $1;}
    | bool_check                {$$ = $1;}
    ;

search
    : NOT query_text field      {$$ = ["!", $2, $3];}
    | query_text field          {$$ = [$1, $2];}
    ;

allsearch
    : query_text all            {$$ = [$1];}
    ;
comparison
    : field comparator number   {$$ = [$1, $2, $3];}
    | number comparator field   {if ($2 === "<") { $$ = [$3, ">", $1]; }
                                 else if ($2 === ">") { $$ = [$3, "<", $1]; }
                                 else if ($2 === "<=") { $$ = [$3, ">=", $1]; }
                                 else if ($2 === ">=") { $$ = [$3, "<=", $1]; }
                                 else if ($2 === "==") { $$ = [$3, "==", $1]; }
                                 else { $$ = [$3, $2, $1];}}
    ;

bool_check
    : field EQ BOOL    {$$ = [$1, $2, ($3.toLowerCase() === 'true')];}
    | field NE BOOL    {$$ = [$1, $2, ($3.toLowerCase() === 'true')];}
    | BOOL EQ field    {$$ = [$3, $2, ($1.toLowerCase() === 'true')];}
    | BOOL NE field    {$$ = [$3, $2, ($1.toLowerCase() === 'true')];}
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
    : CMP_GT               {$$ = $1;}
    | CMP_LT               {$$ = $1;}
    | CMP_GTE              {$$ = $1;}
    | CMP_LTE              {$$ = $1;}
    | EQ                   {$$ = $1;}
    | NE                   {$$ = $1;}
    ;

